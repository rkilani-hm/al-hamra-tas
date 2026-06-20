-- =============================================================================
-- Al Hamra TAS — M3.1-step2a: Dynamic Permission Model + Management (ADDITIVE)
-- =============================================================================
alter table public.tas_permission
  add column if not exists key            text,
  add column if not exists area           text,
  add column if not exists description_en text,
  add column if not exists description_ar text,
  add column if not exists is_system      boolean not null default false;

alter table public.tas_permission alter column module_code drop not null;
alter table public.tas_permission alter column action      drop not null;

create unique index if not exists uq_tas_permission_key
  on public.tas_permission(key) where key is not null;

alter table public.tas_role
  add column if not exists description_en text,
  add column if not exists description_ar text;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('config.manage',      'config',      'Manage Configuration',  'إدارة الإعدادات',          true),
  ('user.admin',         'identity',    'User Administration',   'إدارة المستخدمين',         true),
  ('requisition.write',  'requisition', 'Manage Requisitions',   'إدارة طلبات التوظيف',      false),
  ('requisition.submit', 'requisition', 'Submit Requisitions',   'تقديم طلبات التوظيف',      false),
  ('application.write',  'application', 'Manage Applications',    'إدارة الطلبات',            false),
  ('candidate.write',    'application', 'Manage Candidates',      'إدارة المرشحين',           false),
  ('screening.write',    'screening',   'Conduct Screening',      'إجراء الفرز',              false),
  ('interview.manage',   'interview',   'Manage Interviews',      'إدارة المقابلات',          false),
  ('interview.score',    'interview',   'Score Interviews',       'تقييم المقابلات',          false),
  ('offer.write',        'offer',       'Manage Offers',          'إدارة العروض',             false),
  ('offer.submit',       'offer',       'Submit Offers',          'تقديم العروض',             false),
  ('offer.issue',        'offer',       'Issue Offers',           'إصدار العروض',             false),
  ('offer.respond',      'offer',       'Record Offer Response',  'تسجيل رد العرض',           false),
  ('approval.act',       'approval',    'Act on Approvals',       'اتخاذ إجراء الاعتماد',     false),
  ('report.view',        'reporting',   'View Reports',           'عرض التقارير',             false),
  ('audit.view',         'reporting',   'View Audit Log',         'عرض سجل التدقيق',          false)
on conflict (key) where key is not null do nothing;

update public.tas_role set is_system = true
where code in ('SYSTEM_ADMIN','HR_MANAGER','RECRUITER','HIRING_MANAGER','APPROVER','AUDITOR','INTERVIEWER')
  and is_system is distinct from true;

insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id
from public.tas_role r
join (values
  ('SYSTEM_ADMIN','config.manage'), ('SYSTEM_ADMIN','user.admin'), ('SYSTEM_ADMIN','requisition.write'),
  ('SYSTEM_ADMIN','requisition.submit'), ('SYSTEM_ADMIN','application.write'), ('SYSTEM_ADMIN','candidate.write'),
  ('SYSTEM_ADMIN','screening.write'), ('SYSTEM_ADMIN','interview.manage'), ('SYSTEM_ADMIN','interview.score'),
  ('SYSTEM_ADMIN','offer.write'), ('SYSTEM_ADMIN','offer.submit'), ('SYSTEM_ADMIN','offer.issue'),
  ('SYSTEM_ADMIN','offer.respond'), ('SYSTEM_ADMIN','approval.act'), ('SYSTEM_ADMIN','report.view'),
  ('SYSTEM_ADMIN','audit.view'),
  ('HR_MANAGER','config.manage'), ('HR_MANAGER','requisition.write'), ('HR_MANAGER','requisition.submit'),
  ('HR_MANAGER','application.write'), ('HR_MANAGER','candidate.write'), ('HR_MANAGER','screening.write'),
  ('HR_MANAGER','interview.manage'), ('HR_MANAGER','interview.score'), ('HR_MANAGER','offer.write'),
  ('HR_MANAGER','offer.submit'), ('HR_MANAGER','offer.issue'), ('HR_MANAGER','offer.respond'),
  ('HR_MANAGER','approval.act'), ('HR_MANAGER','report.view'),
  ('RECRUITER','requisition.write'), ('RECRUITER','requisition.submit'), ('RECRUITER','application.write'),
  ('RECRUITER','candidate.write'), ('RECRUITER','screening.write'), ('RECRUITER','interview.manage'),
  ('RECRUITER','interview.score'), ('RECRUITER','offer.write'), ('RECRUITER','offer.submit'),
  ('RECRUITER','offer.respond'), ('RECRUITER','report.view'),
  ('HIRING_MANAGER','requisition.write'), ('HIRING_MANAGER','approval.act'), ('HIRING_MANAGER','report.view'),
  ('APPROVER','approval.act'), ('APPROVER','report.view'),
  ('INTERVIEWER','interview.score'), ('INTERVIEWER','report.view'),
  ('AUDITOR','report.view'), ('AUDITOR','audit.view')
) as g(role_code, perm_key) on g.role_code = r.code
join public.tas_permission p on p.key = g.perm_key
on conflict (role_id, permission_id) do nothing;

create or replace function public._caller_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.key
  from public.tas_user u
  join public.tas_user_role ur       on ur.user_id = u.id
  join public.tas_role r             on r.id = ur.role_id and r.status = 'active'
  join public.tas_role_permission rp on rp.role_id = r.id
  join public.tas_permission p       on p.id = rp.permission_id
  where p.key is not null and u.status = 'active'
    and (
      u.email = nullif(auth.jwt() ->> 'email', '')::citext
      or u.email = nullif(auth.jwt() #>> '{user_metadata,email}', '')::citext
      or u.entra_object_id = nullif(auth.jwt() ->> 'oid', '')
      or u.entra_object_id = nullif(auth.jwt() ->> 'sub', '')
    );
$$;

create or replace function public._has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._is_system_admin()
      or exists (select 1 from public._caller_permissions() pk where pk = p_key);
$$;

create or replace function public.my_capabilities()
returns setof text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public._is_system_admin() then
    return query select p.key from public.tas_permission p where p.key is not null order by p.key;
  else
    return query select pk from public._caller_permissions() pk order by 1;
  end if;
end;
$$;

create or replace function public.perm_list_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_system_admin() then raise exception 'not_authorized'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'key', p.key, 'area', p.area, 'name_en', p.name_en, 'name_ar', p.name_ar,
      'description_en', p.description_en, 'description_ar', p.description_ar, 'is_system', p.is_system
    ) order by p.area, p.key)
    from public.tas_permission p where p.key is not null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.roleperm_list_matrix()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_system_admin() then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'code', r.code, 'name_en', r.name_en, 'name_ar', r.name_ar,
        'is_system', r.is_system, 'description_en', r.description_en, 'description_ar', r.description_ar,
        'user_count', (select count(*) from public.tas_user_role ur where ur.role_id = r.id)
      ) order by r.is_system desc, r.code)
      from public.tas_role r where r.status = 'active'
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'key', p.key, 'area', p.area, 'name_en', p.name_en, 'name_ar', p.name_ar
      ) order by p.area, p.key)
      from public.tas_permission p where p.key is not null
    ), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object('role_id', rp.role_id, 'permission_id', rp.permission_id))
      from public.tas_role_permission rp
      join public.tas_permission p on p.id = rp.permission_id
      where p.key is not null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.role_upsert(
  p_id             uuid default null,
  p_code           text default null,
  p_name_en        text default null,
  p_name_ar        text default null,
  p_description_en text default null,
  p_description_ar text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._is_system_admin() then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    if coalesce(nullif(p_code,''),'') = '' then raise exception 'role_code_required'; end if;
    if exists (select 1 from public.tas_role where code = p_code) then raise exception 'role_code_exists'; end if;
    insert into public.tas_role (code, name_en, name_ar, description_en, description_ar, is_system, status, created_by)
    values (p_code, coalesce(p_name_en, p_code), coalesce(p_name_ar, p_code), p_description_en, p_description_ar,
            false, 'active', v_caller)
    returning id into v_id;
  else
    update public.tas_role set
      name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      description_en = p_description_en, description_ar = p_description_ar, updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.role_delete(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_is_system boolean;
begin
  if not public._is_system_admin() then raise exception 'not_authorized'; end if;
  select is_system into v_is_system from public.tas_role where id = p_role_id;
  if v_is_system then raise exception 'cannot_delete_system_role'; end if;
  if exists (select 1 from public.tas_user_role ur where ur.role_id = p_role_id) then
    raise exception 'role_in_use';
  end if;
  delete from public.tas_role where id = p_role_id;
end;
$$;

create or replace function public.roleperm_grant(p_role_id uuid, p_permission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_system_admin() then raise exception 'not_authorized'; end if;
  insert into public.tas_role_permission (role_id, permission_id)
  values (p_role_id, p_permission_id)
  on conflict (role_id, permission_id) do nothing;
end;
$$;

create or replace function public.roleperm_revoke(p_role_id uuid, p_permission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role_code text; v_perm_key text;
begin
  if not public._is_system_admin() then raise exception 'not_authorized'; end if;
  select code into v_role_code from public.tas_role where id = p_role_id;
  select key into v_perm_key from public.tas_permission where id = p_permission_id;
  if v_role_code = 'SYSTEM_ADMIN' and v_perm_key in ('user.admin','config.manage') then
    raise exception 'cannot_revoke_core_admin';
  end if;
  delete from public.tas_role_permission where role_id = p_role_id and permission_id = p_permission_id;
end;
$$;

grant execute on function public._caller_permissions()                to authenticated;
grant execute on function public._has_permission(text)                to authenticated;
grant execute on function public.my_capabilities()                    to authenticated;
grant execute on function public.perm_list_catalog()                  to authenticated;
grant execute on function public.roleperm_list_matrix()               to authenticated;
grant execute on function public.role_upsert(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.role_delete(uuid)                    to authenticated;
grant execute on function public.roleperm_grant(uuid, uuid)           to authenticated;
grant execute on function public.roleperm_revoke(uuid, uuid)          to authenticated;
