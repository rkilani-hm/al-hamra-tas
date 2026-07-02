-- =============================================================================
-- Al Hamra TAS — Module M2.2: MenaME (MenaITech) HRMS Integration (dormant)
-- =============================================================================
-- Integration status/monitoring surface for the MenaME HRMS adapter (built dormant
-- in M1.11: tas_hrms_adapter_config + handoff_to_mename). Adds status + a dormant
-- connection test. Reuses settings.manage. No new table/key. No storage bucket SQL.
-- No recursive CTEs.
-- =============================================================================

create or replace function public.mename_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'adapter', (select jsonb_build_object('provider', provider, 'is_enabled', is_enabled, 'config_status', config_status)
                from public.tas_hrms_adapter_config where provider = 'mename'),
    'queued_handoffs', (select count(*) from public.tas_onboarding where handoff_status = 'queued')
  );
end; $$;

-- mename_test_connection — dormant: no real HTTP until the MenaITech client is wired.
create or replace function public.mename_test_connection()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_enabled boolean;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;

  select is_enabled into v_enabled from public.tas_hrms_adapter_config where provider = 'mename';

  perform public.audit_log(v_caller, 'M2.2', 'mename.test', 'adapter', 'hrms:mename',
    jsonb_build_object('enabled', coalesce(v_enabled,false)));

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('ok', false, 'dormant', true,
      'message', 'MenaME adapter is dormant. Provision the MenaITech API base URL + credentials and enable the adapter.');
  end if;
  -- Adapter enabled: the real MenaITech client would ping here. Kept dormant.
  return jsonb_build_object('ok', true, 'dormant', false, 'message', 'Adapter enabled (connection client not yet wired).');
end; $$;

grant execute on function public.mename_status()          to authenticated;
grant execute on function public.mename_test_connection() to authenticated;

-- =============================================================================
-- End of M2.2 — MenaME HRMS Integration (dormant).
-- =============================================================================
