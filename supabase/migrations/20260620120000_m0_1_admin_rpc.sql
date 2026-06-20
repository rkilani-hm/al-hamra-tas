-- =============================================================================
-- Al Hamra TAS — M0.1-admin-ui: User & Access Administration RPCs
-- =============================================================================
-- The admin surface for a SYSTEM_ADMIN to provision TAS users: create/edit
-- tas_user, assign/remove roles, assign/remove org scope. Reuses the existing
-- M0.1 tables (tas_user / tas_role / tas_user_role / tas_user_scope) — NO new
-- identity tables.
--
-- Authorization model: each write RPC is SECURITY DEFINER and ASSERTS the caller
-- is an active SYSTEM_ADMIN (the in-RPC check is the gate). This works NOW for the
-- signed-in admin — the definer bypasses the still-service-role table policies,
-- WITHOUT waiting for M3.1's per-role table RLS.
--
-- Rubric 12: tas_user.email is PLAIN `citext not null unique`; tas_user_role PK is
-- (user_id, role_id); tas_user_scope has only an id PK (no natural unique) ->
-- idempotency via existence check. No storage.buckets SQL. No recursive CTEs.
--
-- NOTE vs spec: tas_user.status check is ('unprovisioned','active','inactive') —
-- there is NO 'suspended'. admin_set_user_status validates against the real check.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helpers: is the caller an active SYSTEM_ADMIN? + resolve the caller's id.
-- -----------------------------------------------------------------------------
create or replace function public._is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tas_user u
    join public.tas_user_role ur on ur.user_id = u.id
    join public.tas_role r       on r.id = ur.role_id
    where u.status = 'active' and r.code = 'SYSTEM_ADMIN' and r.status = 'active'
      and (
        u.email = nullif(auth.jwt() ->> 'email', '')::citext
        or u.email = nullif(auth.jwt() #>> '{user_metadata,email}', '')::citext
        or u.entra_object_id = nullif(auth.jwt() ->> 'oid', '')
        or u.entra_object_id = nullif(auth.jwt() ->> 'sub', '')
      )
  );
$$;

create or replace function public._admin_caller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from public.tas_user u
  where u.status = 'active'
    and (
      u.email = nullif(auth.jwt() ->> 'email', '')::citext
      or u.email = nullif(auth.jwt() #>> '{user_metadata,email}', '')::citext
      or u.entra_object_id = nullif(auth.jwt() ->> 'oid', '')
      or u.entra_object_id = nullif(auth.jwt() ->> 'sub', '')
    )
  limit 1;
$$;

-- Active SYSTEM_ADMIN count (for the last-admin lockout guard).
create or replace function public._active_admin_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct u.id)::int
  from public.tas_user u
  join public.tas_user_role ur on ur.user_id = u.id
  join public.tas_role r       on r.id = ur.role_id
  where u.status = 'active' and r.code = 'SYSTEM_ADMIN' and r.status = 'active';
$$;

-- =============================================================================
-- 1. admin_list_roles() — the seeded roles for the assignment UI.
-- =============================================================================
create or replace function public.admin_list_roles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'code', r.code, 'name_en', r.name_en, 'name_ar', r.name_ar,
      'is_system', r.is_system
    ) order by r.code)
    from public.tas_role r where r.status = 'active'
  ), '[]'::jsonb);
end;
$$;

-- =============================================================================
-- 2. admin_list_users(search, status, limit, offset) — users + roles + scope count.
-- =============================================================================
create or replace function public.admin_list_users(
  p_search text    default null,
  p_status text    default null,
  p_limit  int     default 50,
  p_offset int     default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(row order by row->>'created_at' desc)
    from (
      select jsonb_build_object(
        'id', u.id, 'email', u.email::text,
        'display_name_en', u.display_name_en, 'display_name_ar', u.display_name_ar,
        'status', u.status, 'default_locale', u.default_locale, 'created_at', u.created_at,
        'roles', coalesce((
          select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name_en', r.name_en, 'name_ar', r.name_ar) order by r.code)
          from public.tas_user_role ur join public.tas_role r on r.id = ur.role_id
          where ur.user_id = u.id
        ), '[]'::jsonb),
        'scope_count', (select count(*) from public.tas_user_scope s where s.user_id = u.id)
      ) as row
      from public.tas_user u
      where (p_status is null or u.status = p_status)
        and (
          p_search is null or p_search = ''
          or u.email ilike ('%' || p_search || '%')::citext
          or u.display_name_en ilike '%' || p_search || '%'
          or u.display_name_ar ilike '%' || p_search || '%'
        )
      order by u.created_at desc
      limit greatest(coalesce(p_limit, 50), 0)
      offset greatest(coalesce(p_offset, 0), 0)
    ) rows
  ), '[]'::jsonb);
end;
$$;

-- =============================================================================
-- 3. admin_get_user(user_id) — one user + roles + scopes + delegations.
-- =============================================================================
create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  return jsonb_build_object(
    'user', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email::text, 'entra_object_id', u.entra_object_id,
        'display_name_en', u.display_name_en, 'display_name_ar', u.display_name_ar,
        'status', u.status, 'default_locale', u.default_locale,
        'created_at', u.created_at, 'updated_at', u.updated_at
      )
      from public.tas_user u where u.id = p_user_id
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name_en', r.name_en, 'name_ar', r.name_ar) order by r.code)
      from public.tas_user_role ur join public.tas_role r on r.id = ur.role_id
      where ur.user_id = p_user_id
    ), '[]'::jsonb),
    'scopes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'entity_id', s.entity_id, 'branch_id', s.branch_id, 'department_id', s.department_id,
        'is_crossdept_readonly', s.is_crossdept_readonly,
        'entity_name_en', e.name_en, 'entity_name_ar', e.name_ar,
        'branch_name_en', b.name_en, 'branch_name_ar', b.name_ar,
        'department_name_en', d.name_en, 'department_name_ar', d.name_ar
      ) order by e.name_en)
      from public.tas_user_scope s
      left join public.tas_entity e     on e.id = s.entity_id
      left join public.tas_branch b     on b.id = s.branch_id
      left join public.tas_department d on d.id = s.department_id
      where s.user_id = p_user_id
    ), '[]'::jsonb),
    'delegations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', dl.id, 'delegate_user_id', dl.delegate_user_id, 'type', dl.type,
        'start_date', dl.start_date, 'end_date', dl.end_date, 'status', dl.status
      ) order by dl.start_date desc)
      from public.tas_delegation dl where dl.delegator_user_id = p_user_id
    ), '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- 4. admin_upsert_user(...) — create or update a tas_user. Returns user id.
-- =============================================================================
create or replace function public.admin_upsert_user(
  p_id              uuid default null,
  p_email           text default null,
  p_display_name_en text default null,
  p_display_name_ar text default null,
  p_status          text default null,
  p_default_locale  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_id     uuid;
  v_status text := coalesce(nullif(p_status, ''), 'active');
  v_locale text := coalesce(nullif(p_default_locale, ''), 'en');
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  if v_status not in ('unprovisioned', 'active', 'inactive') then
    raise exception 'invalid status %', v_status;
  end if;
  if v_locale not in ('en', 'ar') then v_locale := 'en'; end if;

  v_caller := public._admin_caller_id();

  if p_id is null then
    if coalesce(nullif(p_email, ''), '') = '' then
      raise exception 'email_required';
    end if;
    if exists (select 1 from public.tas_user where email = p_email::citext) then
      raise exception 'email_exists';
    end if;
    insert into public.tas_user (email, display_name_en, display_name_ar, status, default_locale, created_by)
    values (p_email::citext, p_display_name_en, p_display_name_ar, v_status, v_locale, v_caller)
    returning id into v_id;
    perform public.audit_log(v_caller, 'M0.1', 'admin.user_created', 'user', v_id::text,
      jsonb_build_object('email', p_email));
  else
    update public.tas_user set
      display_name_en = p_display_name_en,
      display_name_ar = p_display_name_ar,
      status          = v_status,
      default_locale  = v_locale,
      email           = coalesce(nullif(p_email, '')::citext, email),
      updated_by      = v_caller
    where id = p_id;
    v_id := p_id;
    perform public.audit_log(v_caller, 'M0.1', 'admin.user_updated', 'user', v_id::text, '{}'::jsonb);
  end if;

  return v_id;
end;
$$;

-- =============================================================================
-- 5. admin_set_user_status(user_id, status) — with last-admin lockout guard.
-- =============================================================================
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_is_admin boolean;
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  if p_status not in ('unprovisioned', 'active', 'inactive') then
    raise exception 'invalid status %', p_status;
  end if;

  -- Guard: deactivating the last active SYSTEM_ADMIN would lock everyone out.
  if p_status <> 'active' then
    select exists (
      select 1 from public.tas_user u
      join public.tas_user_role ur on ur.user_id = u.id
      join public.tas_role r       on r.id = ur.role_id
      where u.id = p_user_id and u.status = 'active' and r.code = 'SYSTEM_ADMIN' and r.status = 'active'
    ) into v_is_admin;
    if v_is_admin and public._active_admin_count() <= 1 then
      raise exception 'cannot_remove_last_admin';
    end if;
  end if;

  v_caller := public._admin_caller_id();
  update public.tas_user set status = p_status, updated_by = v_caller where id = p_user_id;
  perform public.audit_log(v_caller, 'M0.1', 'admin.user_status', 'user', p_user_id::text,
    jsonb_build_object('status', p_status));
end;
$$;

-- =============================================================================
-- 6. admin_assign_role / admin_remove_role — manage tas_user_role.
-- =============================================================================
create or replace function public.admin_assign_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid;
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  v_caller := public._admin_caller_id();
  insert into public.tas_user_role (user_id, role_id, created_by)
  values (p_user_id, p_role_id, v_caller)
  on conflict (user_id, role_id) do nothing;
  perform public.audit_log(v_caller, 'M0.1', 'admin.role_assigned', 'user', p_user_id::text,
    jsonb_build_object('role_id', p_role_id));
end;
$$;

create or replace function public.admin_remove_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid;
  v_code     text;
  v_is_admin boolean;
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;

  select code into v_code from public.tas_role where id = p_role_id;

  -- Guard: removing the SYSTEM_ADMIN role from the last active admin locks out.
  if v_code = 'SYSTEM_ADMIN' then
    select exists (
      select 1 from public.tas_user u
      join public.tas_user_role ur on ur.user_id = u.id
      where u.id = p_user_id and u.status = 'active' and ur.role_id = p_role_id
    ) into v_is_admin;
    if v_is_admin and public._active_admin_count() <= 1 then
      raise exception 'cannot_remove_last_admin';
    end if;
  end if;

  v_caller := public._admin_caller_id();
  delete from public.tas_user_role where user_id = p_user_id and role_id = p_role_id;
  perform public.audit_log(v_caller, 'M0.1', 'admin.role_removed', 'user', p_user_id::text,
    jsonb_build_object('role_id', p_role_id));
end;
$$;

-- =============================================================================
-- 7. admin_assign_scope / admin_remove_scope — manage tas_user_scope.
-- =============================================================================
create or replace function public.admin_assign_scope(
  p_user_id       uuid,
  p_entity_id     uuid,
  p_branch_id     uuid default null,
  p_department_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_id     uuid;
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  if p_entity_id is null then
    raise exception 'entity_required';
  end if;

  -- Idempotent: reuse an identical scope row if it already exists (no natural unique).
  select id into v_id from public.tas_user_scope
  where user_id = p_user_id and entity_id = p_entity_id
    and branch_id is not distinct from p_branch_id
    and department_id is not distinct from p_department_id
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  v_caller := public._admin_caller_id();
  insert into public.tas_user_scope (user_id, entity_id, branch_id, department_id, created_by)
  values (p_user_id, p_entity_id, p_branch_id, p_department_id, v_caller)
  returning id into v_id;
  perform public.audit_log(v_caller, 'M0.1', 'admin.scope_assigned', 'user', p_user_id::text,
    jsonb_build_object('scope_id', v_id, 'entity_id', p_entity_id));
  return v_id;
end;
$$;

create or replace function public.admin_remove_scope(p_scope_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_user   uuid;
begin
  if not public._is_system_admin() then
    raise exception 'not_authorized';
  end if;
  select user_id into v_user from public.tas_user_scope where id = p_scope_id;
  v_caller := public._admin_caller_id();
  delete from public.tas_user_scope where id = p_scope_id;
  perform public.audit_log(v_caller, 'M0.1', 'admin.scope_removed', 'user', coalesce(v_user::text, ''),
    jsonb_build_object('scope_id', p_scope_id));
end;
$$;

-- =============================================================================
-- 8. GRANTS — authenticated; the in-RPC SYSTEM_ADMIN check is the gate.
-- =============================================================================
grant execute on function public._is_system_admin()    to authenticated;
grant execute on function public._admin_caller_id()     to authenticated;
grant execute on function public._active_admin_count()  to authenticated;
grant execute on function public.admin_list_roles()                                   to authenticated;
grant execute on function public.admin_list_users(text, text, int, int)               to authenticated;
grant execute on function public.admin_get_user(uuid)                                 to authenticated;
grant execute on function public.admin_upsert_user(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text)                    to authenticated;
grant execute on function public.admin_assign_role(uuid, uuid)                        to authenticated;
grant execute on function public.admin_remove_role(uuid, uuid)                        to authenticated;
grant execute on function public.admin_assign_scope(uuid, uuid, uuid, uuid)           to authenticated;
grant execute on function public.admin_remove_scope(uuid)                             to authenticated;

-- =============================================================================
-- End of M0.1-admin-ui RPCs.
-- =============================================================================
