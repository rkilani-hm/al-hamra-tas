-- =============================================================================
-- Al Hamra TAS — Module M1.1: Manpower Planning & Headcount
-- =============================================================================
-- Budgeted headcount by fiscal year / entity / department / job position, with
-- Kuwaitization target tracking. Upstream of M1.2 requisitions. RBAC via new key
-- manpower.manage. Reads open; writes via SECURITY DEFINER RPCs. No storage bucket
-- SQL. No recursive CTEs.
-- =============================================================================

create table if not exists public.tas_manpower_plan (
  id                       uuid primary key default gen_random_uuid(),
  fiscal_year              int not null,
  entity_id                uuid references public.tas_entity(id),
  department_id            uuid references public.tas_department(id),
  job_position_id          uuid references public.tas_job_position(id),
  budgeted_headcount       int not null default 0,
  kuwaitization_target_pct numeric check (kuwaitization_target_pct is null or (kuwaitization_target_pct >= 0 and kuwaitization_target_pct <= 100)),
  status                   text not null default 'draft' check (status in ('draft','active','closed')),
  notes                    text,
  created_at               timestamptz not null default now(),
  created_by               uuid,
  updated_at               timestamptz not null default now(),
  updated_by               uuid
);
comment on table public.tas_manpower_plan is 'Budgeted headcount plan per fiscal year / org unit / position (M1.1).';
create index if not exists idx_tas_manpower_plan_year on public.tas_manpower_plan(fiscal_year, department_id);

drop trigger if exists trg_tas_manpower_plan_updated_at on public.tas_manpower_plan;
create trigger trg_tas_manpower_plan_updated_at before update on public.tas_manpower_plan
  for each row execute function public.tas_set_updated_at();

alter table public.tas_manpower_plan enable row level security;
drop policy if exists tas_manpower_plan_sel on public.tas_manpower_plan;
create policy tas_manpower_plan_sel on public.tas_manpower_plan for select to authenticated using (true);
grant select on public.tas_manpower_plan to authenticated;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('manpower.manage', 'manpower', 'Manage Manpower Planning', 'إدارة تخطيط القوى العاملة', false)
on conflict (key) where key is not null do nothing;
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('HIRING_MANAGER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'manpower.manage'
on conflict (role_id, permission_id) do nothing;

-- upsert_manpower_plan — insert (p_id null) or update by id.
create or replace function public.upsert_manpower_plan(
  p_id uuid,
  p_fiscal_year int,
  p_entity_id uuid,
  p_department_id uuid,
  p_job_position_id uuid,
  p_budgeted int,
  p_kuwait_pct numeric default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_id uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('manpower.manage') then raise exception 'not_authorized'; end if;
  if p_fiscal_year is null then raise exception 'fiscal_year required'; end if;

  if p_id is null then
    insert into public.tas_manpower_plan
      (fiscal_year, entity_id, department_id, job_position_id, budgeted_headcount, kuwaitization_target_pct, notes, created_by)
    values
      (p_fiscal_year, p_entity_id, p_department_id, p_job_position_id, coalesce(p_budgeted,0), p_kuwait_pct, p_notes, v_caller)
    returning id into v_id;
  else
    update public.tas_manpower_plan
      set fiscal_year = p_fiscal_year, entity_id = p_entity_id, department_id = p_department_id,
          job_position_id = p_job_position_id, budgeted_headcount = coalesce(p_budgeted,0),
          kuwaitization_target_pct = p_kuwait_pct, notes = p_notes, updated_by = v_caller
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'plan % not found', p_id; end if;
  end if;

  perform public.audit_log(v_caller, 'M1.1', 'manpower.upserted', 'manpower_plan', v_id::text,
    jsonb_build_object('fiscal_year', p_fiscal_year, 'budgeted', p_budgeted));
  return v_id;
end; $$;

create or replace function public.set_manpower_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  if p_status not in ('draft','active','closed') then raise exception 'invalid status %', p_status; end if;
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('manpower.manage') then raise exception 'not_authorized'; end if;
  update public.tas_manpower_plan set status = p_status, updated_by = v_caller where id = p_id;
  if not found then raise exception 'plan % not found', p_id; end if;
  perform public.audit_log(v_caller, 'M1.1', 'manpower.status', 'manpower_plan', p_id::text, jsonb_build_object('status', p_status));
end; $$;

-- list_manpower_plans — budget vs active requisitions (utilization). Read open.
create or replace function public.list_manpower_plans(p_fiscal_year int default null, p_limit int default 100, p_offset int default 0)
returns table(
  id uuid, fiscal_year int, entity_id uuid, department_id uuid, job_position_id uuid,
  budgeted_headcount int, kuwaitization_target_pct numeric, status text, open_requisitions bigint
)
language sql stable security definer set search_path = public as $$
  select mp.id, mp.fiscal_year, mp.entity_id, mp.department_id, mp.job_position_id,
         mp.budgeted_headcount, mp.kuwaitization_target_pct, mp.status,
         (select count(*) from public.tas_requisition r
            where r.department_id = mp.department_id
              and (mp.job_position_id is null or r.job_position_id = mp.job_position_id)
              and r.status not in ('draft','cancelled','closed')) as open_requisitions
  from public.tas_manpower_plan mp
  where (p_fiscal_year is null or mp.fiscal_year = p_fiscal_year)
  order by mp.fiscal_year desc, mp.created_at desc
  limit greatest(coalesce(p_limit, 100), 0) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.manpower_plan_detail(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', (select to_jsonb(mp) from public.tas_manpower_plan mp where mp.id = p_id),
    'entity', (select jsonb_build_object('id', e.id, 'name_en', e.name_en, 'name_ar', e.name_ar)
               from public.tas_entity e join public.tas_manpower_plan mp on mp.entity_id = e.id where mp.id = p_id),
    'department', (select jsonb_build_object('id', d.id, 'name_en', d.name_en, 'name_ar', d.name_ar)
               from public.tas_department d join public.tas_manpower_plan mp on mp.department_id = d.id where mp.id = p_id),
    'position', (select jsonb_build_object('id', jp.id, 'name_en', jp.name_en, 'name_ar', jp.name_ar)
               from public.tas_job_position jp join public.tas_manpower_plan mp on mp.job_position_id = jp.id where mp.id = p_id)
  );
$$;

grant execute on function public.upsert_manpower_plan(uuid, int, uuid, uuid, uuid, int, numeric, text) to authenticated;
grant execute on function public.set_manpower_status(uuid, text)                                        to authenticated;
grant execute on function public.list_manpower_plans(int, int, int)                                     to authenticated;
grant execute on function public.manpower_plan_detail(uuid)                                             to authenticated;

-- =============================================================================
-- End of M1.1 — Manpower Planning & Headcount.
-- =============================================================================
