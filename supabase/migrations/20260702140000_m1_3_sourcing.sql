-- =============================================================================
-- Al Hamra TAS — Module M1.3: Candidate Sourcing & Talent Pool
-- =============================================================================
-- Talent pool over M1.5 candidates with sourcing metadata (channel, tags, status).
-- RBAC via new key sourcing.manage. Reads open; writes via SECURITY DEFINER RPCs.
-- No storage bucket SQL. No recursive CTEs.
-- =============================================================================

create table if not exists public.tas_talent_pool (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null unique references public.tas_candidate(id),
  source_channel text not null default 'other' check (source_channel in ('internal','referral','agency','database','portal','other')),
  agency_name    text,
  referred_by    text,
  tags           text[] not null default '{}',
  pool_status    text not null default 'active' check (pool_status in ('active','passive','placed','archived')),
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_talent_pool is 'Talent pool entry per candidate with sourcing metadata (M1.3).';
create index if not exists idx_tas_talent_pool_status on public.tas_talent_pool(pool_status, source_channel);

drop trigger if exists trg_tas_talent_pool_updated_at on public.tas_talent_pool;
create trigger trg_tas_talent_pool_updated_at before update on public.tas_talent_pool
  for each row execute function public.tas_set_updated_at();

alter table public.tas_talent_pool enable row level security;
drop policy if exists tas_talent_pool_sel on public.tas_talent_pool;
create policy tas_talent_pool_sel on public.tas_talent_pool for select to authenticated using (true);
grant select on public.tas_talent_pool to authenticated;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('sourcing.manage', 'sourcing', 'Manage Sourcing & Talent Pool', 'إدارة المصادر ومجمع المواهب', false)
on conflict (key) where key is not null do nothing;
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('RECRUITER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'sourcing.manage'
on conflict (role_id, permission_id) do nothing;

-- add_to_talent_pool — upsert per candidate (idempotent on candidate_id unique).
create or replace function public.add_to_talent_pool(
  p_candidate_id uuid,
  p_channel text default 'other',
  p_agency text default null,
  p_referred_by text default null,
  p_tags jsonb default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_id uuid; v_tags text[];
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('sourcing.manage') then raise exception 'not_authorized'; end if;
  if coalesce(p_channel,'other') not in ('internal','referral','agency','database','portal','other') then raise exception 'invalid channel %', p_channel; end if;

  select coalesce(array_agg(x), '{}') into v_tags
  from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as x;

  insert into public.tas_talent_pool (candidate_id, source_channel, agency_name, referred_by, tags, notes, created_by)
  values (p_candidate_id, coalesce(p_channel,'other'), p_agency, p_referred_by, v_tags, p_notes, v_caller)
  on conflict (candidate_id) do update
    set source_channel = excluded.source_channel, agency_name = excluded.agency_name,
        referred_by = excluded.referred_by, tags = excluded.tags, notes = excluded.notes,
        updated_by = v_caller
  returning id into v_id;

  perform public.audit_log(v_caller, 'M1.3', 'sourcing.pooled', 'talent_pool', v_id::text,
    jsonb_build_object('candidate_id', p_candidate_id, 'channel', p_channel));
  return v_id;
end; $$;

create or replace function public.update_pool_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  if p_status not in ('active','passive','placed','archived') then raise exception 'invalid status %', p_status; end if;
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('sourcing.manage') then raise exception 'not_authorized'; end if;
  update public.tas_talent_pool set pool_status = p_status, updated_by = v_caller where id = p_id;
  if not found then raise exception 'pool entry % not found', p_id; end if;
  perform public.audit_log(v_caller, 'M1.3', 'sourcing.status', 'talent_pool', p_id::text, jsonb_build_object('status', p_status));
end; $$;

create or replace function public.list_talent_pool(
  p_channel text default null, p_status text default null, p_limit int default 100, p_offset int default 0
)
returns table(
  id uuid, candidate_id uuid, candidate_name_en text, candidate_name_ar text, email text,
  source_channel text, agency_name text, tags text[], pool_status text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select tp.id, tp.candidate_id, c.full_name_en, c.full_name_ar, c.email,
         tp.source_channel, tp.agency_name, tp.tags, tp.pool_status, tp.created_at
  from public.tas_talent_pool tp
  left join public.tas_candidate c on c.id = tp.candidate_id
  where (p_channel is null or tp.source_channel = p_channel)
    and (p_status is null or tp.pool_status = p_status)
  order by tp.created_at desc
  limit greatest(coalesce(p_limit, 100), 0) offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.add_to_talent_pool(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.update_pool_status(uuid, text)                            to authenticated;
grant execute on function public.list_talent_pool(text, text, int, int)                    to authenticated;

-- =============================================================================
-- End of M1.3 — Candidate Sourcing & Talent Pool.
-- =============================================================================
