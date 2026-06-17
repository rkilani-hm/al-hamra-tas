-- =============================================================================
-- Al Hamra TAS — Module M0.1: Identity & Access
-- =============================================================================
-- Scope: identity ACCESS only (users, roles, permissions, scope, delegation,
--        sessions, access audit) plus MINIMAL org stubs so scope FKs resolve.
--
-- NOT in this migration (belongs to later modules):
--   * person / employee / Civil ID / work-permit tables  -> later HR modules
--   * full org master data (M0.2 expands tas_entity/branch/department)
--
-- Authorization model:
--   * Microsoft Entra ID is used for AUTHENTICATION ONLY (OIDC).
--   * Authorization is TAS-INTERNAL: roles/permissions/scope live in these
--     tables and are NEVER derived from Entra group membership.
--
-- Conventions:
--   * UUID primary keys via gen_random_uuid() (pgcrypto / pg built-in).
--   * citext for case-insensitive email / codes where noted.
--   * Audit columns (created_at/created_by/updated_at/updated_by) on main tables.
--   * updated_at maintained by trigger tas_set_updated_at().
--
-- -----------------------------------------------------------------------------
-- RLS NOTE (read before tightening):
--   RLS is ENABLED on every tas_* table below. The policies here are a
--   SCAFFOLD for the M0.1 phase:
--     * service_role (edge functions) performs ALL writes and provisioning.
--     * authenticated users may SELECT only their OWN identity rows
--       (tas_user / tas_user_role / tas_user_scope).
--   Fine-grained, per-role read/write policies (module + action + org scope)
--   will be defined in Module M3.1 (Security & Permissions hardening).
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "citext";   -- case-insensitive text

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.tas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. MINIMAL ORG STUBS  (Entity -> Branch -> Department)
--    M0.2 will expand these; defined now so identity scope FKs resolve.
-- =============================================================================

create table if not exists public.tas_entity (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_ar     text not null,
  status      text not null default 'active',
  -- audit
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_entity is 'M0.1 stub: top-level legal/operating entity. Expanded in M0.2.';

create table if not exists public.tas_branch (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.tas_entity(id) on delete cascade,
  code        text not null,
  name_en     text not null,
  name_ar     text not null,
  status      text not null default 'active',
  -- audit
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (entity_id, code)
);
comment on table public.tas_branch is 'M0.1 stub: branch under an entity. Expanded in M0.2.';

create table if not exists public.tas_department (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.tas_branch(id) on delete cascade,
  code        text not null,
  name_en     text not null,
  name_ar     text not null,
  status      text not null default 'active',
  -- audit
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (branch_id, code)
);
comment on table public.tas_department is 'M0.1 stub: department under a branch. Expanded in M0.2.';

-- =============================================================================
-- 2. IDENTITY & ACCESS CORE
-- =============================================================================

-- tas_user — a TAS principal, linked to an Entra identity (auth only).
create table if not exists public.tas_user (
  id               uuid primary key default gen_random_uuid(),
  entra_object_id  text unique,                 -- Entra ID 'oid' claim (OIDC). May be null until first sign-in.
  email            citext not null unique,      -- case-insensitive; fallback match key
  display_name_en  text,
  display_name_ar  text,
  status           text not null default 'unprovisioned'
                     check (status in ('unprovisioned','active','inactive')),
  default_locale   text not null default 'en'
                     check (default_locale in ('en','ar')),
  -- audit
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
comment on table public.tas_user is 'TAS principal. Entra provides authentication only; authorization is internal.';
comment on column public.tas_user.entra_object_id is 'Entra ID oid claim. Primary match key on sign-in; email is the fallback.';
comment on column public.tas_user.status is 'unprovisioned (seen but no access) | active | inactive (access revoked).';

-- tas_role — internal role definitions.
create table if not exists public.tas_role (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_ar     text not null,
  is_system   boolean not null default false,   -- system roles are seeded and protected
  status      text not null default 'active',
  -- audit
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_role is 'Internal TAS roles. Never derived from Entra groups.';

-- tas_permission — atomic capability: (module_code, action).
create table if not exists public.tas_permission (
  id           uuid primary key default gen_random_uuid(),
  module_code  text not null,
  action       text not null
                 check (action in ('view','create','edit','approve','delete','export')),
  name_en      text,
  name_ar      text,
  unique (module_code, action)
);
comment on table public.tas_permission is 'Atomic capability per module + action. Granted to roles, not users.';

-- tas_role_permission — role grants.
create table if not exists public.tas_role_permission (
  role_id        uuid not null references public.tas_role(id) on delete cascade,
  permission_id  uuid not null references public.tas_permission(id) on delete cascade,
  primary key (role_id, permission_id)
);
comment on table public.tas_role_permission is 'Role -> permission grants (effective permission = union over a user''s roles).';

-- tas_user_role — user role assignments.
create table if not exists public.tas_user_role (
  user_id     uuid not null references public.tas_user(id) on delete cascade,
  role_id     uuid not null references public.tas_role(id) on delete cascade,
  -- audit
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (user_id, role_id)
);
comment on table public.tas_user_role is 'User -> role assignments.';

-- tas_user_scope — org scoping (Entity -> Branch -> Department) per user.
create table if not exists public.tas_user_scope (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.tas_user(id) on delete cascade,
  entity_id              uuid not null references public.tas_entity(id) on delete cascade,
  branch_id              uuid references public.tas_branch(id) on delete cascade,
  department_id          uuid references public.tas_department(id) on delete cascade,
  is_crossdept_readonly  boolean not null default false,
  -- audit
  created_at             timestamptz not null default now(),
  created_by             uuid,
  updated_at             timestamptz not null default now(),
  updated_by             uuid
);
comment on table public.tas_user_scope is 'Org-scoped access. branch_id/department_id null = whole entity/branch.';
comment on column public.tas_user_scope.is_crossdept_readonly is 'If true, user may read sibling departments within scope (read-only).';

-- tas_delegation — temporary delegation of access from one user to another.
create table if not exists public.tas_delegation (
  id                 uuid primary key default gen_random_uuid(),
  delegator_user_id  uuid not null references public.tas_user(id) on delete cascade,
  delegate_user_id   uuid not null references public.tas_user(id) on delete cascade,
  type               text not null
                       check (type in ('role_wide','task_specific')),
  scope_json         jsonb not null default '[]',   -- task-specific targets/constraints
  start_date         date,
  end_date           date,
  status             text not null default 'active'
                       check (status in ('active','expired','revoked')),
  -- audit
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
comment on table public.tas_delegation is 'Temporary delegation (e.g. approver on leave). Honored only while status=active and within dates.';

-- tas_session — server-tracked sessions (Entra issues the token; TAS tracks the session).
create table if not exists public.tas_session (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.tas_user(id) on delete cascade,
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz,
  last_seen_at  timestamptz,
  revoked_at    timestamptz,
  ip            text,
  user_agent    text
);
comment on table public.tas_session is 'TAS-side session tracking for audit/revocation. Auth itself is Entra OIDC.';

-- tas_access_audit — append-only access/security event log.
create table if not exists public.tas_access_audit (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.tas_user(id) on delete set null,
  event_type   text not null
                 check (event_type in ('signin','signout','role_change','scope_change',
                                       'delegation','denied','deactivate','provision')),
  detail_json  jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
comment on table public.tas_access_audit is 'Append-only audit trail of identity/access events.';

-- =============================================================================
-- 3. INDEXES  (FKs + lookup paths)
-- =============================================================================

-- FK / lookup indexes
create index if not exists idx_tas_branch_entity        on public.tas_branch(entity_id);
create index if not exists idx_tas_department_branch     on public.tas_department(branch_id);

create index if not exists idx_tas_user_email            on public.tas_user(email);
create index if not exists idx_tas_user_entra_object_id  on public.tas_user(entra_object_id);

create index if not exists idx_tas_role_permission_perm  on public.tas_role_permission(permission_id);
create index if not exists idx_tas_user_role_role        on public.tas_user_role(role_id);

create index if not exists idx_tas_user_scope_user       on public.tas_user_scope(user_id);
create index if not exists idx_tas_user_scope_entity     on public.tas_user_scope(entity_id);
create index if not exists idx_tas_user_scope_branch     on public.tas_user_scope(branch_id);
create index if not exists idx_tas_user_scope_department on public.tas_user_scope(department_id);

create index if not exists idx_tas_delegation_delegator  on public.tas_delegation(delegator_user_id);
create index if not exists idx_tas_delegation_delegate   on public.tas_delegation(delegate_user_id);
create index if not exists idx_tas_delegation_window     on public.tas_delegation(status, start_date, end_date);

create index if not exists idx_tas_session_user          on public.tas_session(user_id);

create index if not exists idx_tas_access_audit_lookup   on public.tas_access_audit(user_id, event_type, created_at);

-- =============================================================================
-- 4. updated_at TRIGGERS  (main tables with audit columns)
-- =============================================================================

drop trigger if exists trg_tas_entity_updated_at      on public.tas_entity;
create trigger trg_tas_entity_updated_at      before update on public.tas_entity
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_branch_updated_at      on public.tas_branch;
create trigger trg_tas_branch_updated_at      before update on public.tas_branch
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_department_updated_at  on public.tas_department;
create trigger trg_tas_department_updated_at  before update on public.tas_department
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_user_updated_at        on public.tas_user;
create trigger trg_tas_user_updated_at        before update on public.tas_user
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_role_updated_at        on public.tas_role;
create trigger trg_tas_role_updated_at        before update on public.tas_role
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_user_role_updated_at   on public.tas_user_role;
create trigger trg_tas_user_role_updated_at   before update on public.tas_user_role
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_user_scope_updated_at  on public.tas_user_scope;
create trigger trg_tas_user_scope_updated_at  before update on public.tas_user_scope
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_delegation_updated_at  on public.tas_delegation;
create trigger trg_tas_delegation_updated_at  before update on public.tas_delegation
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 5. ROW LEVEL SECURITY  (scaffold — see RLS NOTE at top; tightened in M3.1)
-- =============================================================================

alter table public.tas_entity        enable row level security;
alter table public.tas_branch        enable row level security;
alter table public.tas_department    enable row level security;
alter table public.tas_user          enable row level security;
alter table public.tas_role          enable row level security;
alter table public.tas_permission    enable row level security;
alter table public.tas_role_permission enable row level security;
alter table public.tas_user_role     enable row level security;
alter table public.tas_user_scope    enable row level security;
alter table public.tas_delegation    enable row level security;
alter table public.tas_session       enable row level security;
alter table public.tas_access_audit  enable row level security;

-- service_role bypasses RLS by default in Supabase, so edge functions retain
-- full read/write. The policies below grant the MINIMUM to authenticated users.
-- All other access (including every write) is implicitly denied for non-service
-- roles until M3.1 introduces per-role policies.

-- A user may read their own tas_user row.
-- auth.jwt() ->> 'oid' carries the Entra object id when present; we also allow
-- email match as a fallback (Entra emails the 'email'/'preferred_username' claim).
drop policy if exists tas_user_select_self on public.tas_user;
create policy tas_user_select_self on public.tas_user
  for select to authenticated
  using (
    entra_object_id = (auth.jwt() ->> 'oid')
    or email = (auth.jwt() ->> 'email')::citext
  );

-- A user may read their own role assignments.
drop policy if exists tas_user_role_select_self on public.tas_user_role;
create policy tas_user_role_select_self on public.tas_user_role
  for select to authenticated
  using (
    user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = (auth.jwt() ->> 'email')::citext
    )
  );

-- A user may read their own org scope.
drop policy if exists tas_user_scope_select_self on public.tas_user_scope;
create policy tas_user_scope_select_self on public.tas_user_scope
  for select to authenticated
  using (
    user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = (auth.jwt() ->> 'email')::citext
    )
  );

-- NOTE: tas_role / tas_permission / tas_role_permission / tas_delegation /
-- tas_session / tas_access_audit and ALL writes are intentionally left with no
-- authenticated-user policy => access only via service_role until M3.1.

-- =============================================================================
-- 6. SEED DATA  (idempotent — ON CONFLICT DO NOTHING)
-- =============================================================================

-- System roles (bilingual, is_system = true).
insert into public.tas_role (code, name_en, name_ar, is_system) values
  ('SYSTEM_ADMIN',   'System Administrator', 'مسؤول النظام',        true),
  ('HR_MANAGER',     'HR Manager',           'مدير الموارد البشرية', true),
  ('RECRUITER',      'Recruiter',            'أخصائي توظيف',         true),
  ('HIRING_MANAGER', 'Hiring Manager',       'مدير التوظيف',         true),
  ('APPROVER',       'Approver',             'معتمِد',               true),
  ('AUDITOR',        'Auditor',              'مدقق',                 true),
  ('INTERVIEWER',    'Interviewer',          'مُحاوِر',              true)
on conflict (code) do nothing;

-- Permissions for module M0.1 (view/create/edit/delete).
insert into public.tas_permission (module_code, action, name_en, name_ar) values
  ('M0.1', 'view',   'View Identity & Access',   'عرض الهوية والوصول'),
  ('M0.1', 'create', 'Create Identity & Access', 'إنشاء الهوية والوصول'),
  ('M0.1', 'edit',   'Edit Identity & Access',   'تعديل الهوية والوصول'),
  ('M0.1', 'delete', 'Delete Identity & Access', 'حذف الهوية والوصول')
on conflict (module_code, action) do nothing;

-- Grant ALL M0.1 permissions to SYSTEM_ADMIN.
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id
from public.tas_role r
cross join public.tas_permission p
where r.code = 'SYSTEM_ADMIN'
  and p.module_code = 'M0.1'
on conflict (role_id, permission_id) do nothing;

-- =============================================================================
-- End of Module M0.1 migration.
-- =============================================================================
