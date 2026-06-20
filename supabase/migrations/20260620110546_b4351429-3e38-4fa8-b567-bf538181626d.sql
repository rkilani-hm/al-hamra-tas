-- =============================================================================
-- Al Hamra TAS — M0.1-signin: Entra SAML SSO identity resolution + bootstrap admin
-- =============================================================================

insert into public.tas_user (email, display_name_en, display_name_ar, status, default_locale)
values ('rkilani@alhamra.com.kw', 'Rami Kilani', 'رامي كيلاني', 'active', 'en')
on conflict (email) do nothing;

insert into public.tas_user_role (user_id, role_id)
select u.id, r.id
from public.tas_user u
cross join public.tas_role r
where u.email = 'rkilani@alhamra.com.kw'::citext
  and r.code = 'SYSTEM_ADMIN'
on conflict (user_id, role_id) do nothing;

insert into public.tas_user_scope (user_id, entity_id)
select u.id, e.id
from public.tas_user u
cross join public.tas_entity e
where u.email = 'rkilani@alhamra.com.kw'::citext
  and e.code = 'SAMPLE_ENT'
  and not exists (
    select 1 from public.tas_user_scope s
    where s.user_id = u.id and s.entity_id = e.id
      and s.branch_id is null and s.department_id is null
  );

create or replace function public.resolve_current_user()
returns table(
  id              uuid,
  email           text,
  display_name_en text,
  display_name_ar text,
  status          text,
  default_locale  text
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, u.display_name_en, u.display_name_ar, u.status, u.default_locale
  from public.tas_user u
  where u.status = 'active'
    and (
      u.email = nullif(auth.jwt() ->> 'email', '')::citext
      or u.email = nullif(auth.jwt() #>> '{user_metadata,email}', '')::citext
      or u.entra_object_id = nullif(auth.jwt() ->> 'oid', '')
      or u.entra_object_id = nullif(auth.jwt() ->> 'sub', '')
    )
  limit 1;
$$;

create or replace function public.current_user_roles()
returns table(role_code text, name_en text, name_ar text)
language sql
stable
security definer
set search_path = public
as $$
  select r.code, r.name_en, r.name_ar
  from public.tas_user u
  join public.tas_user_role ur on ur.user_id = u.id
  join public.tas_role r       on r.id = ur.role_id
  where u.status = 'active'
    and (
      u.email = nullif(auth.jwt() ->> 'email', '')::citext
      or u.email = nullif(auth.jwt() #>> '{user_metadata,email}', '')::citext
      or u.entra_object_id = nullif(auth.jwt() ->> 'oid', '')
      or u.entra_object_id = nullif(auth.jwt() ->> 'sub', '')
    )
    and r.status = 'active'
  order by r.code;
$$;

create or replace function public.current_user_scopes()
returns table(
  entity_id             uuid,
  branch_id             uuid,
  department_id         uuid,
  is_crossdept_readonly boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.entity_id, s.branch_id, s.department_id, s.is_crossdept_readonly
  from public.tas_user u
  join public.tas_user_scope s on s.user_id = u.id
  where u.status = 'active'
    and (
      u.email = nullif(auth.jwt() ->> 'email', '')::citext
      or u.email = nullif(auth.jwt() #>> '{user_metadata,email}', '')::citext
      or u.entra_object_id = nullif(auth.jwt() ->> 'oid', '')
      or u.entra_object_id = nullif(auth.jwt() ->> 'sub', '')
    );
$$;

grant execute on function public.resolve_current_user() to authenticated;
grant execute on function public.current_user_roles()   to authenticated;
grant execute on function public.current_user_scopes()  to authenticated;
