-- =============================================================================
-- Al Hamra TAS — Module M2.1: AI Recruitment Copilot (dormant adapter)
-- =============================================================================
-- AI copilot scaffolding gated behind tas_ai_adapter_config (disabled by default).
-- No LLM call until a key is provisioned — dormant responses only. RBAC via new
-- key ai.use. Registers into the M3.2 unified adapter surface (list_adapters /
-- set_adapter_enabled extended with the 'ai' kind). No storage bucket SQL.
-- No recursive CTEs.
-- =============================================================================

create table if not exists public.tas_ai_adapter_config (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null unique check (provider in ('llm')),
  is_enabled    boolean not null default false,
  config_status text not null default 'unconfigured' check (config_status in ('unconfigured','configured')),
  model         text,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.tas_ai_adapter_config is 'Dormant AI/LLM adapter flags (M2.1). NEVER stores secrets.';

insert into public.tas_ai_adapter_config (provider, is_enabled, config_status, notes)
values ('llm', false, 'unconfigured', 'AI copilot — dormant until an LLM API key is provisioned in secrets.')
on conflict (provider) do nothing;

drop trigger if exists trg_tas_ai_adapter_updated_at on public.tas_ai_adapter_config;
create trigger trg_tas_ai_adapter_updated_at before update on public.tas_ai_adapter_config
  for each row execute function public.tas_set_updated_at();

alter table public.tas_ai_adapter_config enable row level security;
drop policy if exists tas_ai_adapter_sel on public.tas_ai_adapter_config;
create policy tas_ai_adapter_sel on public.tas_ai_adapter_config for select to authenticated using (true);
grant select on public.tas_ai_adapter_config to authenticated;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('ai.use', 'ai', 'Use AI Copilot', 'استخدام مساعد الذكاء الاصطناعي', false)
on conflict (key) where key is not null do nothing;
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('RECRUITER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'ai.use'
on conflict (role_id, permission_id) do nothing;

create or replace function public.ai_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('ai.use') then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_build_object('provider', provider, 'is_enabled', is_enabled, 'config_status', config_status, 'model', model)
    from public.tas_ai_adapter_config where provider = 'llm'
  ), jsonb_build_object('is_enabled', false, 'config_status', 'unconfigured'));
end; $$;

-- ai_generate_jd — dormant: returns a not-configured notice unless the adapter is enabled.
create or replace function public.ai_generate_jd(p_title text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_enabled boolean;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('ai.use') then raise exception 'not_authorized'; end if;

  select is_enabled into v_enabled from public.tas_ai_adapter_config where provider = 'llm';

  perform public.audit_log(v_caller, 'M2.1', 'ai.generate_jd', 'ai', 'llm',
    jsonb_build_object('title', p_title, 'enabled', coalesce(v_enabled,false)));

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('dormant', true, 'output', null,
      'message', 'AI copilot is dormant. Enable the AI adapter in System Settings to use it.');
  end if;

  -- Adapter enabled: the ai-copilot edge function performs the real generation
  -- (invoked client-side). Return an accepted marker for the UI to hydrate.
  return jsonb_build_object('dormant', false, 'output', null, 'message', 'accepted');
end; $$;

-- Extend the M3.2 unified adapter surface to include the 'ai' kind.
create or replace function public.list_adapters()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._has_permission('settings.manage') then raise exception 'not_authorized'; end if;
  return (select coalesce(jsonb_agg(row order by row->>'kind', row->>'provider'), '[]'::jsonb) from (
      select jsonb_build_object('kind','comm','provider',provider,'is_enabled',is_enabled,'config_status',config_status) as row from public.tas_comm_adapter_config
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
  if p_kind = 'comm' then update public.tas_comm_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'storage' then update public.tas_storage_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'hrms' then update public.tas_hrms_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  elsif p_kind = 'ai' then update public.tas_ai_adapter_config set is_enabled = p_enabled, updated_by = v_caller where provider = p_provider;
  else raise exception 'invalid kind %', p_kind; end if;
  if not found then raise exception 'adapter %/% not found', p_kind, p_provider; end if;
  perform public.audit_log(v_caller, 'M3.2', 'settings.adapter', 'adapter', p_kind || ':' || p_provider, jsonb_build_object('enabled', p_enabled));
end; $$;

grant execute on function public.ai_status()                     to authenticated;
grant execute on function public.ai_generate_jd(text, text)      to authenticated;
grant execute on function public.list_adapters()                 to authenticated;
grant execute on function public.set_adapter_enabled(text, text, boolean) to authenticated;

-- =============================================================================
-- End of M2.1 — AI Recruitment Copilot (dormant).
-- =============================================================================
