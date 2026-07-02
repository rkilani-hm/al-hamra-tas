-- =============================================================================
-- Al Hamra TAS — Module M2.3: Microsoft 365 Integration (dormant)
-- =============================================================================
-- Unifies the M365 surface: Entra (auth, live), Outlook/Teams (comm adapter,
-- dormant), SharePoint (storage adapter, dormant). Also FIXES M3.2's list_adapters
-- / set_adapter_enabled: tas_comm_adapter_config keys on `channel` (not provider).
-- No new table, no new key. Reuses settings.manage. No storage bucket SQL. No
-- recursive CTEs.
-- =============================================================================

-- Fix: comm adapter is keyed on `channel`; alias it as provider for the unified view.
create or replace function public.list_adapters()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  return (select coalesce(jsonb_agg(row order by row->>'kind', row->>'provider'), '[]'::jsonb) from (
      select jsonb_build_object('kind','comm','provider',channel,'is_enabled',is_enabled,'config_status',config_status) as row from public.tas_comm_adapter_config
      union all select jsonb_build_object('kind','storage','provider',provider,'is_enabled',is_enabled,'config_status',config_status) from public.tas_storage_adapter_config
      union all select jsonb_build_object('kind','hrms','provider',provider,'is_enabled',is_enabled,'config_status',config_status) from public.tas_hrms_adapter_config
      union all select jsonb_build_object('kind','ai','provider',provider,'is_enabled',is_enabled,'config_status',config_status) from public.tas_ai_adapter_config) u);
end; $$;

create or replace function public.set_adapter_enabled(p_kind text, p_provider text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  if p_kind = 'comm' then update public.tas_comm_adapter_config set is_enabled = p_enabled, updated_by = v_caller where channel = p_provider;
  elsif p_kind = 'storage' then update public.tas_storage_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'hrms' then update public.tas_hrms_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'ai' then update public.tas_ai_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  else raise exception 'invalid kind %', p_kind; end if;
  if not found then raise exception 'adapter %/% not found', p_kind, p_provider; end if;
  perform public.audit_log(v_caller, 'M3.2', 'settings.adapter', 'adapter', p_kind || ':' || p_provider, jsonb_build_object('enabled', p_enabled));
end; $$;

-- m365_status — unified Microsoft 365 component view.
create or replace function public.m365_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'entra', jsonb_build_object('component', 'entra', 'kind', 'auth', 'status', 'live'),
    'outlook', (select jsonb_build_object('component','outlook','kind','comm','provider',channel,'is_enabled',is_enabled,'config_status',config_status)
                from public.tas_comm_adapter_config where channel = 'outlook_email'),
    'teams', (select jsonb_build_object('component','teams','kind','comm','provider',channel,'is_enabled',is_enabled,'config_status',config_status)
              from public.tas_comm_adapter_config where channel = 'teams'),
    'sharepoint', (select jsonb_build_object('component','sharepoint','kind','storage','provider',provider,'is_enabled',is_enabled,'config_status',config_status)
                   from public.tas_storage_adapter_config where provider = 'sharepoint')
  );
end; $$;

grant execute on function public.list_adapters()                         to authenticated;
grant execute on function public.set_adapter_enabled(text, text, boolean) to authenticated;
grant execute on function public.m365_status()                           to authenticated;

-- =============================================================================
-- End of M2.3 — Microsoft 365 Integration (dormant); comm-channel fix included.
-- =============================================================================
