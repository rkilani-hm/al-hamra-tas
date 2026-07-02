-- =============================================================================
-- Al Hamra TAS — Module M1.11: Onboarding & MenaME (MenaITech) Handoff
-- =============================================================================
-- After pre-boarding (M1.10) completes, create an onboarding record and hand the
-- new hire to MenaME HRMS. MenaME is a DORMANT adapter (tas_hrms_adapter_config,
-- disabled by default) — the handoff is captured/queued in-app until credentials
-- are provisioned. RBAC via new key onboarding.manage. No storage bucket SQL.
-- No recursive CTEs. Reads open; writes via SECURITY DEFINER RPCs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.tas_onboarding (
  id                 uuid primary key default gen_random_uuid(),
  preboarding_id     uuid not null unique references public.tas_preboarding(id),
  application_id     uuid references public.tas_application(id),
  candidate_id       uuid references public.tas_candidate(id),
  status             text not null default 'pending' check (status in ('pending','handed_off','completed','cancelled')),
  mename_employee_ref text,
  handoff_status     text not null default 'not_sent' check (handoff_status in ('not_sent','queued','sent','ack','error')),
  handoff_payload    jsonb not null default '{}',
  handed_off_at      timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
comment on table public.tas_onboarding is 'One onboarding record per completed pre-boarding; drives the MenaME handoff (M1.11).';

create index if not exists idx_tas_onboarding_status on public.tas_onboarding(status, handoff_status);

-- Dormant HRMS adapter flags (NEVER secrets; mirrors M0.4/M0.5 adapter config).
create table if not exists public.tas_hrms_adapter_config (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null unique check (provider in ('mename')),
  is_enabled    boolean not null default false,
  config_status text not null default 'unconfigured' check (config_status in ('unconfigured','configured')),
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.tas_hrms_adapter_config is 'Per-provider enable/config flags for the HRMS handoff. NEVER stores secrets.';

insert into public.tas_hrms_adapter_config (provider, is_enabled, config_status, notes)
values ('mename', false, 'unconfigured', 'MenaITech HRMS — dormant until API base URL + credentials are provisioned in secrets.')
on conflict (provider) do nothing;

-- -----------------------------------------------------------------------------
-- 2. triggers
-- -----------------------------------------------------------------------------
drop trigger if exists trg_tas_onboarding_updated_at on public.tas_onboarding;
create trigger trg_tas_onboarding_updated_at before update on public.tas_onboarding
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_hrms_adapter_updated_at on public.tas_hrms_adapter_config;
create trigger trg_tas_hrms_adapter_updated_at before update on public.tas_hrms_adapter_config
  for each row execute function public.tas_set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
alter table public.tas_onboarding          enable row level security;
alter table public.tas_hrms_adapter_config enable row level security;

drop policy if exists tas_onboarding_sel on public.tas_onboarding;
create policy tas_onboarding_sel on public.tas_onboarding for select to authenticated using (true);
drop policy if exists tas_hrms_adapter_sel on public.tas_hrms_adapter_config;
create policy tas_hrms_adapter_sel on public.tas_hrms_adapter_config for select to authenticated using (true);

grant select on public.tas_onboarding          to authenticated;
grant select on public.tas_hrms_adapter_config to authenticated;

-- -----------------------------------------------------------------------------
-- 4. NEW KEY — onboarding.manage
-- -----------------------------------------------------------------------------
insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('onboarding.manage', 'onboarding', 'Manage Onboarding', 'إدارة الالتحاق', false)
on conflict (key) where key is not null do nothing;

insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id
from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'onboarding.manage'
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------
create or replace function public.start_onboarding(p_preboarding_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_ob     uuid;
  v_pb     public.tas_preboarding;
  v_payload jsonb;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('onboarding.manage') then raise exception 'not_authorized'; end if;

  select * into v_pb from public.tas_preboarding where id = p_preboarding_id;
  if v_pb.id is null then raise exception 'preboarding % not found', p_preboarding_id; end if;
  if v_pb.status <> 'completed' then raise exception 'preboarding_not_completed'
    using message = 'Pre-boarding must be completed before onboarding.'; end if;

  select id into v_ob from public.tas_onboarding where preboarding_id = p_preboarding_id;
  if v_ob is not null then return v_ob; end if;

  select jsonb_build_object(
    'candidate', (select jsonb_build_object('id', c.id, 'name_en', c.full_name_en, 'name_ar', c.full_name_ar,
                          'email', c.email, 'nationality', c.nationality)
                  from public.tas_candidate c where c.id = v_pb.candidate_id),
    'application_id', v_pb.application_id,
    'offer_id', v_pb.offer_id
  ) into v_payload;

  insert into public.tas_onboarding (preboarding_id, application_id, candidate_id, handoff_payload, created_by)
  values (p_preboarding_id, v_pb.application_id, v_pb.candidate_id, coalesce(v_payload,'{}'::jsonb), v_caller)
  returning id into v_ob;

  perform public.audit_log(v_caller, 'M1.11', 'onboarding.started', 'onboarding', v_ob::text,
    jsonb_build_object('preboarding_id', p_preboarding_id));
  return v_ob;
end;
$$;

-- handoff_to_mename — dormant: queues when the adapter is disabled; stub-sends when enabled.
create or replace function public.handoff_to_mename(p_onboarding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_enabled boolean;
  v_new     text;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('onboarding.manage') then raise exception 'not_authorized'; end if;

  select is_enabled into v_enabled from public.tas_hrms_adapter_config where provider = 'mename';

  if coalesce(v_enabled, false) then
    v_new := 'sent';
    update public.tas_onboarding
      set handoff_status = 'sent', status = 'handed_off', handed_off_at = now(), updated_by = v_caller
    where id = p_onboarding_id;
  else
    v_new := 'queued';
    update public.tas_onboarding
      set handoff_status = 'queued', updated_by = v_caller
    where id = p_onboarding_id;
  end if;
  if not found then raise exception 'onboarding % not found', p_onboarding_id; end if;

  perform public.audit_log(v_caller, 'M1.11', 'onboarding.handoff', 'onboarding', p_onboarding_id::text,
    jsonb_build_object('handoff_status', v_new, 'adapter_enabled', coalesce(v_enabled,false)));
  return jsonb_build_object('handoff_status', v_new, 'adapter_enabled', coalesce(v_enabled,false));
end;
$$;

create or replace function public.complete_onboarding(p_onboarding_id uuid, p_mename_ref text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('onboarding.manage') then raise exception 'not_authorized'; end if;

  update public.tas_onboarding
    set status = 'completed', handoff_status = 'ack',
        mename_employee_ref = coalesce(p_mename_ref, mename_employee_ref), updated_by = v_caller
  where id = p_onboarding_id;
  if not found then raise exception 'onboarding % not found', p_onboarding_id; end if;

  perform public.audit_log(v_caller, 'M1.11', 'onboarding.completed', 'onboarding', p_onboarding_id::text,
    jsonb_build_object('mename_ref', p_mename_ref));
end;
$$;

create or replace function public.onboarding_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'onboarding', (select to_jsonb(o) from public.tas_onboarding o where o.id = p_id),
    'candidate', (select jsonb_build_object('id', c.id, 'full_name_en', c.full_name_en,
                          'full_name_ar', c.full_name_ar, 'email', c.email)
                  from public.tas_candidate c join public.tas_onboarding o on o.candidate_id = c.id where o.id = p_id),
    'application', (select jsonb_build_object('id', a.id, 'reference', a.reference, 'status', a.status)
                    from public.tas_application a join public.tas_onboarding o on o.application_id = a.id where o.id = p_id),
    'adapter', (select jsonb_build_object('provider', h.provider, 'is_enabled', h.is_enabled, 'config_status', h.config_status)
                from public.tas_hrms_adapter_config h where h.provider = 'mename')
  );
$$;

create or replace function public.list_onboarding(p_status text default null, p_limit int default 50, p_offset int default 0)
returns table(
  id uuid, application_id uuid, candidate_id uuid, candidate_name_en text, candidate_name_ar text,
  reference text, status text, handoff_status text, mename_employee_ref text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.application_id, o.candidate_id, c.full_name_en, c.full_name_ar, a.reference,
         o.status, o.handoff_status, o.mename_employee_ref, o.created_at
  from public.tas_onboarding o
  left join public.tas_candidate c on c.id = o.candidate_id
  left join public.tas_application a on a.id = o.application_id
  where (p_status is null or o.status = p_status)
  order by o.created_at desc
  limit greatest(coalesce(p_limit, 50), 0) offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- 6. GRANTS
-- -----------------------------------------------------------------------------
grant execute on function public.start_onboarding(uuid)                 to authenticated;
grant execute on function public.handoff_to_mename(uuid)                to authenticated;
grant execute on function public.complete_onboarding(uuid, text)        to authenticated;
grant execute on function public.onboarding_detail(uuid)                to authenticated;
grant execute on function public.list_onboarding(text, int, int)        to authenticated;

-- =============================================================================
-- End of M1.11 — Onboarding & MenaME Handoff (adapter dormant).
-- =============================================================================
