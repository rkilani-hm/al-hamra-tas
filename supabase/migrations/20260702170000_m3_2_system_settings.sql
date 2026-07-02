-- =============================================================================
-- Al Hamra TAS — Module M3.2: Admin & System Settings
-- =============================================================================
-- SYSTEM_ADMIN surface: app-wide key/value settings + unified view/toggle of the
-- dormant integration adapters (comm/storage/hrms). New key settings.manage.
-- Reads open to authenticated SELECT; writes via SECURITY DEFINER RPCs gated on
-- settings.manage. No storage bucket SQL. No recursive CTEs.
-- =============================================================================

create table if not exists public.tas_system_setting (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value_json  jsonb not null default '{}',
  category    text,
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_system_setting is 'App-wide key/value settings (M3.2). Never stores secrets.';

drop trigger if exists trg_tas_system_setting_updated_at on public.tas_system_setting;
create trigger trg_tas_system_setting_updated_at before update on public.tas_system_setting
  for each row execute function public.tas_set_updated_at();

alter table public.tas_system_setting enable row level security;
drop policy if exists tas_system_setting_sel on public.tas_system_setting;
create policy tas_system_setting_sel on public.tas_system_setting for select to authenticated using (true);
grant select on public.tas_system_setting to authenticated;

-- Seed defaults (idempotent on key unique).
insert into public.tas_system_setting (key, value_json, category, description) values
  ('default_language',       '"en"'::jsonb,                              'general', 'Default UI language'),
  ('careers_portal_enabled', 'true'::jsonb,                              'general', 'Public careers portal enabled'),
  ('org_name_en',            '"Al Hamra Real Estate Group"'::jsonb,      'general', 'Organization display name (EN)'),
  ('org_name_ar',            '"مجموعة الحمراء العقارية"'::jsonb,          'general', 'Organization display name (AR)')
on conflict (key) do nothing;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('settings.manage', 'settings', 'Manage System Settings', 'إدارة إعدادات النظام', false)
on conflict (key) where key is not null do nothing;
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id from public.tas_role r
join (values ('SYSTEM_ADMIN')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'settings.manage'
on conflict (role_id, permission_id) do nothing;

create or replace function public.list_system_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('key', key, 'value', value_json, 'category', category, 'description', description) order by key)
    from public.tas_system_setting
  ), '[]'::jsonb);
end; $$;

create or replace function public.set_system_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  insert into public.tas_system_setting (key, value_json, created_by)
  values (p_key, coalesce(p_value,'{}'::jsonb), v_caller)
  on conflict (key) do update set value_json = excluded.value_json, updated_by = v_caller;
  perform public.audit_log(v_caller, 'M3.2', 'settings.set', 'system_setting', p_key, jsonb_build_object('value', p_value));
end; $$;

-- list_adapters — unified read of the three dormant adapter config tables.
create or replace function public.list_adapters()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  return (
    select coalesce(jsonb_agg(row order by row->>'kind', row->>'provider'), '[]'::jsonb) from (
      select jsonb_build_object('kind','comm','provider',provider,'is_enabled',is_enabled,'config_status',config_status) as row from public.tas_comm_adapter_config
      union all
      select jsonb_build_object('kind','storage','provider',provider,'is_enabled',is_enabled,'config_status',config_status) from public.tas_storage_adapter_config
      union all
      select jsonb_build_object('kind','hrms','provider',provider,'is_enabled',is_enabled,'config_status',config_status) from public.tas_hrms_adapter_config
    ) u
  );
end; $$;

create or replace function public.set_adapter_enabled(p_kind text, p_provider text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  if p_kind = 'comm' then
    update public.tas_comm_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'storage' then
    update public.tas_storage_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'hrms' then
    update public.tas_hrms_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  else
    raise exception 'invalid kind %', p_kind;
  end if;
  if not found then raise exception 'adapter %/% not found', p_kind, p_provider; end if;
  perform public.audit_log(v_caller, 'M3.2', 'settings.adapter', 'adapter', p_kind || ':' || p_provider, jsonb_build_object('enabled', p_enabled));
end; $$;

grant execute on function public.list_system_settings()                    to authenticated;
grant execute on function public.set_system_setting(text, jsonb)           to authenticated;
grant execute on function public.list_adapters()                           to authenticated;
grant execute on function public.set_adapter_enabled(text, text, boolean)  to authenticated;

-- =============================================================================
-- End of M3.2 — Admin & System Settings.
-- =============================================================================
