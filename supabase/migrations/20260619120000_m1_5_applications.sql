-- =============================================================================
-- Al Hamra TAS — Module M1.5: Application Tracking (ATS Pipeline)
-- =============================================================================
-- The ATS core: tas_candidate (separate entity, one candidate → many
-- applications) + tas_application (belongs to an M1.2 requisition) moving through
-- a CONFIGURABLE tas_pipeline_stage set, with append-only stage history. NOT a
-- workflow-engine integration — a candidate entity + a stage state-machine.
--
-- Conventions (M0.x/M1.2): UUID PKs, audit cols + tas_set_updated_at() trigger,
-- bilingual where natural, status checks, FK/hot indexes.
--
-- RLS posture (M1.5; per-role tightening in M3.1):
--   * All four tables: authenticated SELECT.
--   * tas_pipeline_stage writes service-role (config).
--   * Candidate + application + stage-history writes go through SECURITY DEFINER
--     RPCs (granted to authenticated — recruiters operate the ATS), so table-level
--     writes stay service-role. stage history is append-only (no update/delete).
-- No SQL references the storage bucket table. No recursive CTEs.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Candidate — a person who applies (feeds the future M1.3 talent pool).
create table if not exists public.tas_candidate (
  id                uuid primary key default gen_random_uuid(),
  first_name        text,
  last_name         text,
  full_name_en      text,
  full_name_ar      text,
  email             citext,
  phone             text,
  nationality       text,
  nationality_class text,             -- reuse tas_lookup 'nationality_class' (Kuwaiti/GCC/Expat)
  current_title     text,
  source            text,
  status            text not null default 'active' check (status in ('active','archived','blacklisted')),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
comment on table public.tas_candidate is 'Candidate entity. nationality_class captured for later Kuwaitization reporting (no quota logic here).';
-- Unique email when present (nulls allowed/distinct via partial index).
create unique index if not exists uq_tas_candidate_email on public.tas_candidate(email) where email is not null;
create index if not exists idx_tas_candidate_nat_class on public.tas_candidate(nationality_class);
create index if not exists idx_tas_candidate_status     on public.tas_candidate(status);

-- Configurable pipeline stage set.
create table if not exists public.tas_pipeline_stage (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_ar     text not null,
  sort_order  int not null default 0,
  stage_type  text not null default 'open'
                check (stage_type in ('open','interview','offer','hired','rejected','withdrawn')),
  is_terminal boolean not null default false,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_pipeline_stage is 'Configurable, ordered ATS stages. Deactivating a stage hides it from new moves; existing applications keep their stage.';
create index if not exists idx_tas_pipeline_stage_order on public.tas_pipeline_stage(sort_order);

-- Application — a candidate applying to a requisition.
create table if not exists public.tas_application (
  id               uuid primary key default gen_random_uuid(),
  reference        text unique,
  requisition_id   uuid not null references public.tas_requisition(id),
  candidate_id     uuid not null references public.tas_candidate(id),
  current_stage_id uuid references public.tas_pipeline_stage(id),
  status           text not null default 'active'
                     check (status in ('active','hired','rejected','withdrawn','on_hold')),
  applied_at       timestamptz not null default now(),
  source           text,
  owner_user_id    uuid references public.tas_user(id),
  rejection_reason text,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
comment on table public.tas_application is 'Candidate application to a requisition, moving through the pipeline.';
create index if not exists idx_tas_application_req    on public.tas_application(requisition_id, status);
create index if not exists idx_tas_application_cand   on public.tas_application(candidate_id);
create index if not exists idx_tas_application_stage  on public.tas_application(current_stage_id);
create index if not exists idx_tas_application_owner  on public.tas_application(owner_user_id);
create index if not exists idx_tas_application_ref    on public.tas_application(reference);
-- No duplicate ACTIVE application for the same (requisition, candidate).
create unique index if not exists uq_tas_application_active_pair
  on public.tas_application(requisition_id, candidate_id) where status = 'active';

-- Append-only stage-move history.
create table if not exists public.tas_application_stage_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tas_application(id) on delete cascade,
  from_stage_id  uuid references public.tas_pipeline_stage(id),
  to_stage_id    uuid references public.tas_pipeline_stage(id),
  moved_by       uuid references public.tas_user(id),
  note           text,
  created_at     timestamptz not null default now()
);
comment on table public.tas_application_stage_history is 'Append-only history of application stage moves.';
create index if not exists idx_tas_app_stage_hist on public.tas_application_stage_history(application_id, created_at);

-- =============================================================================
-- 2. updated_at TRIGGERS
-- =============================================================================
drop trigger if exists trg_tas_candidate_updated_at on public.tas_candidate;
create trigger trg_tas_candidate_updated_at before update on public.tas_candidate
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_pipeline_stage_updated_at on public.tas_pipeline_stage;
create trigger trg_tas_pipeline_stage_updated_at before update on public.tas_pipeline_stage
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_application_updated_at on public.tas_application;
create trigger trg_tas_application_updated_at before update on public.tas_application
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 3. REFERENCE GENERATION — APP-YYYY-NNNN (year-aware atomic counter)
-- =============================================================================
create table if not exists public.tas_application_counter (
  fiscal_year int primary key,
  last_no     int not null default 0
);
comment on table public.tas_application_counter is 'Per-year counter backing generate_application_ref() (APP-YYYY-NNNN).';

create or replace function public.generate_application_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_no   int;
begin
  insert into public.tas_application_counter (fiscal_year, last_no)
  values (v_year, 1)
  on conflict (fiscal_year)
  do update set last_no = public.tas_application_counter.last_no + 1
  returning last_no into v_no;
  return 'APP-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- Auto-assign reference on application insert if not provided.
create or replace function public.tas_application_set_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null then
    new.reference := public.generate_application_ref();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tas_application_set_ref on public.tas_application;
create trigger trg_tas_application_set_ref before insert on public.tas_application
  for each row execute function public.tas_application_set_ref();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (authenticated SELECT; writes via RPC/service-role)
-- =============================================================================
alter table public.tas_candidate                 enable row level security;
alter table public.tas_pipeline_stage            enable row level security;
alter table public.tas_application               enable row level security;
alter table public.tas_application_stage_history enable row level security;
alter table public.tas_application_counter       enable row level security; -- internal; no policy

-- Authenticated SELECT on all four user-facing tables (scope tightened in M3.1).
-- Candidate / application / stage-history writes flow through the SECURITY
-- DEFINER RPCs below (upsert_candidate, create_application, move_application_stage,
-- set_application_status) — so no authenticated write policy is needed here, and
-- pipeline-stage config writes stay service-role-only until M3.1.
drop policy if exists tas_candidate_select_auth on public.tas_candidate;
create policy tas_candidate_select_auth on public.tas_candidate
  for select to authenticated using (true);

drop policy if exists tas_pipeline_stage_select_auth on public.tas_pipeline_stage;
create policy tas_pipeline_stage_select_auth on public.tas_pipeline_stage
  for select to authenticated using (true);

drop policy if exists tas_application_select_auth on public.tas_application;
create policy tas_application_select_auth on public.tas_application
  for select to authenticated using (true);

drop policy if exists tas_app_stage_hist_select_auth on public.tas_application_stage_history;
create policy tas_app_stage_hist_select_auth on public.tas_application_stage_history
  for select to authenticated using (true);

-- =============================================================================
-- 5. GRANTS
-- =============================================================================
grant select on public.tas_candidate                 to authenticated;
grant select on public.tas_pipeline_stage            to authenticated;
grant select on public.tas_application               to authenticated;
grant select on public.tas_application_stage_history to authenticated;

-- =============================================================================
-- 6. SEED (idempotent)
-- =============================================================================

-- 6a. Default ordered pipeline (bilingual). Terminal stages flagged.
insert into public.tas_pipeline_stage (code, name_en, name_ar, sort_order, stage_type, is_terminal) values
  ('applied',     'Applied',     'تم التقديم',  10,  'open',      false),
  ('screening',   'Screening',   'الفرز',       20,  'open',      false),
  ('shortlisted', 'Shortlisted', 'القائمة المختصرة', 30, 'open',  false),
  ('interview',   'Interview',   'المقابلة',    40,  'interview', false),
  ('assessment',  'Assessment',  'التقييم',     50,  'open',      false),
  ('offer',       'Offer',       'العرض',       60,  'offer',     false),
  ('hired',       'Hired',       'تم التعيين',  90,  'hired',     true),
  ('rejected',    'Rejected',    'مرفوض',       99,  'rejected',  true),
  ('withdrawn',   'Withdrawn',   'منسحب',       100, 'withdrawn', true)
on conflict (code) do nothing;

-- 6b. SAMPLE candidates (clearly marked) so the list/board have data.
insert into public.tas_candidate (first_name, last_name, full_name_en, full_name_ar, email, nationality_class, current_title, source, status) values
  ('Sample', 'Candidate One', 'Sample Candidate One', 'مرشح تجريبي ١', 'sample.candidate1@example.com', 'kuwaiti', 'HR Officer', 'sample', 'active'),
  ('Sample', 'Candidate Two', 'Sample Candidate Two', 'مرشح تجريبي ٢', 'sample.candidate2@example.com', 'expat',   'Accountant', 'sample', 'active')
on conflict (email) do nothing;

-- =============================================================================
-- End of schema/seed. RPCs follow in 20260619120001_m1_5_applications_rpc.sql
-- =============================================================================
