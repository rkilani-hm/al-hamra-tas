-- =============================================================================
-- Al Hamra TAS — Module M3.1 (consent): Data Privacy & Candidate Consent
-- =============================================================================
-- Completes M3.1 Security & Compliance data-privacy/consent sub-scope. Tracks
-- candidate consent (data processing, background check, retention, marketing) with
-- grant/withdraw + retention window. RBAC via new key consent.manage. Reads open;
-- writes via SECURITY DEFINER RPCs. No storage bucket SQL. No recursive CTEs.
-- =============================================================================

create table if not exists public.tas_candidate_consent (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references public.tas_candidate(id),
  consent_type   text not null check (consent_type in ('data_processing','background_check','data_retention','marketing')),
  granted        boolean not null default false,
  granted_at     timestamptz,
  withdrawn_at   timestamptz,
  retention_until date,
  source         text,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_candidate_consent is 'Per-candidate data-privacy consent records (M3.1 consent).';
-- One row per consent type per candidate (rubric-12 upsert target).
create unique index if not exists uq_tas_candidate_consent
  on public.tas_candidate_consent(candidate_id, consent_type);

drop trigger if exists trg_tas_candidate_consent_updated_at on public.tas_candidate_consent;
create trigger trg_tas_candidate_consent_updated_at before update on public.tas_candidate_consent
  for each row execute function public.tas_set_updated_at();

alter table public.tas_candidate_consent enable row level security;
drop policy if exists tas_candidate_consent_sel on public.tas_candidate_consent;
create policy tas_candidate_consent_sel on public.tas_candidate_consent for select to authenticated using (true);
grant select on public.tas_candidate_consent to authenticated;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('consent.manage', 'consent', 'Manage Candidate Consent', 'إدارة موافقات المرشحين', false)
on conflict (key) where key is not null do nothing;
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('RECRUITER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'consent.manage'
on conflict (role_id, permission_id) do nothing;

-- record_consent — upsert per (candidate, type).
create or replace function public.record_consent(
  p_candidate_id uuid,
  p_type text,
  p_granted boolean,
  p_retention_until date default null,
  p_source text default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_id uuid;
begin
  if p_type not in ('data_processing','background_check','data_retention','marketing') then raise exception 'invalid type %', p_type; end if;
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('consent.manage') then raise exception 'not_authorized'; end if;

  insert into public.tas_candidate_consent
    (candidate_id, consent_type, granted, granted_at, withdrawn_at, retention_until, source, notes, created_by)
  values
    (p_candidate_id, p_type, p_granted,
     case when p_granted then now() else null end,
     case when p_granted then null else now() end,
     p_retention_until, p_source, p_notes, v_caller)
  on conflict (candidate_id, consent_type) do update
    set granted        = excluded.granted,
        granted_at     = case when excluded.granted then coalesce(public.tas_candidate_consent.granted_at, now()) else public.tas_candidate_consent.granted_at end,
        withdrawn_at   = case when excluded.granted then null else now() end,
        retention_until = excluded.retention_until,
        source         = excluded.source,
        notes          = excluded.notes,
        updated_by     = v_caller
  returning id into v_id;

  perform public.audit_log(v_caller, 'M3.1', 'consent.recorded', 'candidate_consent', v_id::text,
    jsonb_build_object('candidate_id', p_candidate_id, 'type', p_type, 'granted', p_granted));
  return v_id;
end; $$;

create or replace function public.list_candidate_consents(p_candidate_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'consent_type', consent_type, 'granted', granted, 'granted_at', granted_at,
      'withdrawn_at', withdrawn_at, 'retention_until', retention_until, 'source', source, 'notes', notes
    ) order by consent_type)
    from public.tas_candidate_consent where candidate_id = p_candidate_id
  ), '[]'::jsonb);
$$;

grant execute on function public.record_consent(uuid, text, boolean, date, text, text) to authenticated;
grant execute on function public.list_candidate_consents(uuid)                          to authenticated;

-- =============================================================================
-- End of M3.1 (consent) — Data Privacy & Candidate Consent.
-- =============================================================================
