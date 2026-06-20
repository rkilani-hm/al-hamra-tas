-- =============================================================================
-- Al Hamra TAS — M0.1-signin: Entra SAML SSO identity resolution + bootstrap admin
-- =============================================================================
-- Supabase trusts Entra SAML sessions (Lovable-managed). This migration wires the
-- DB layer: server-side resolution of the authenticated session to a tas_user
-- (the single source of truth for currentUserId — never trust a client id), plus
-- helper RPCs for the caller's roles/scopes, and the seeded bootstrap admin so the
-- first sign-in can administer everyone else.
--
-- Auth model (M0.1): Entra authenticates; TAS owns authorization. SSO identity
-- maps to a tas_user by EMAIL (citext). PRE-PROVISIONED access: a signed-in user
-- with no active tas_user resolves to empty -> the app shows /no-access.
--
-- Rubric 12 note: tas_user.email is a PLAIN `citext not null unique` (NOT a
-- partial index — that's tas_candidate). So the seed uses `on conflict (email)
-- do nothing`. tas_user_role PK is (user_id, role_id). tas_user_scope has only an
-- id PK (no natural unique) + entity_id NOT NULL, so it is seeded idempotently via
-- insert…select…where not exists, scoped to the seeded SAMPLE_ENT entity.
-- No storage.buckets SQL. No recursive CTEs.
-- =============================================================================

-- =============================================================================
-- 1. BOOTSTRAP ADMIN (idempotent)
-- =============================================================================

-- 1a. The admin tas_user.
insert into public.tas_user (email, display_name_en, display_name_ar, status, default_locale)
values ('rkilani@alhamra.com.kw', 'Rami Kilani', 'رامي كيلاني', 'active', 'en')
on conflict (email) do nothing;

-- 1b. SYSTEM_ADMIN role assignment (resolve role by code; PK (user_id, role_id)).
insert into public.tas_user_role (user_id, role_id)
select u.id, r.id
from public.tas_user u
cross join public.tas_role r
where u.email = 'rkilani@alhamra.com.kw'::citext
  and r.code = 'SYSTEM_ADMIN'
on conflict (user_id, role_id) do nothing;

-- 1c. Top-level scope. tas_user_scope.entity_id is NOT NULL, so an "all scope"
--     null row is not representable — scope the admin to the seeded SAMPLE_ENT
--     (whole entity: branch_id/department_id null). Admin can broaden later via
--     the M0.1 scope UI. No natural unique -> guard with NOT EXISTS for idempotency.
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

-- =============================================================================
-- 2. resolve_current_user() — server-side session -> tas_user (currentUserId).
--    Matches the SAML email claim (user.mail), then user_metadata.email, then the
--    Entra oid. Returns ONLY an active row; empty for unprovisioned users.
-- =============================================================================
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

-- =============================================================================
-- 3. current_user_roles() — the caller's role codes (for client-side UI gating).
-- =============================================================================
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

-- =============================================================================
-- 4. current_user_scopes() — the caller's org scopes (for client-side UI gating).
-- =============================================================================
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

-- =============================================================================
-- 5. GRANTS — authenticated callers resolve their own identity (SECURITY DEFINER).
-- =============================================================================
grant execute on function public.resolve_current_user() to authenticated;
grant execute on function public.current_user_roles()   to authenticated;
grant execute on function public.current_user_scopes()  to authenticated;

-- =============================================================================
-- End of M0.1-signin bootstrap + resolution RPCs.
-- =============================================================================
