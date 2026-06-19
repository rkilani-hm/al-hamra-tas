-- =============================================================================
-- Al Hamra TAS — Module M1.6: Screening & Shortlisting
-- =============================================================================
-- A thin screening layer on M1.5: a CONFIGURABLE scorecard (reusable bilingual
-- criteria), per-application screening records with weighted overall score +
-- recommendation. Submitting a 'shortlist'/'reject' drives the application stage
-- via the EXISTING M1.5 move_application_stage RPC — NOT a workflow-engine module.
--
-- Conventions: UUID PKs, audit cols + tas_set_updated_at() trigger, bilingual
-- name_en/name_ar, status checks, FK indexes.
--
-- RLS posture (M1.6; per-role tightening M3.1):
--   * scorecard + criterion: authenticated SELECT; writes service-role (config).
--   * screening + score: authenticated SELECT; writes via SECURITY DEFINER RPCs
--     granted to authenticated (recruiter action) — table-level writes service-role.
-- No SQL references the storage bucket table. No recursive CTEs. ON CONFLICT
-- targets match plain unique indexes (rubric 12).
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Reusable scorecard template.
create table if not exists public.tas_screening_scorecard (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name_en        text not null,
  name_ar        text not null,
  description_en text,
  description_ar text,
  status         text not null default 'active' check (status in ('active','inactive')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_screening_scorecard is 'Reusable screening scorecard template (configurable).';

-- Criteria within a scorecard.
create table if not exists public.tas_screening_criterion (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.tas_screening_scorecard(id) on delete cascade,
  code         text not null,
  name_en      text not null,
  name_ar      text not null,
  weight       numeric not null default 1,
  max_score    int not null default 5,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (scorecard_id, code)
);
comment on table public.tas_screening_criterion is 'Bilingual scored criterion within a scorecard (weight + max_score).';
create index if not exists idx_tas_screening_criterion_card on public.tas_screening_criterion(scorecard_id, sort_order);

-- Per-application screening record.
create table if not exists public.tas_screening (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tas_application(id) on delete cascade,
  scorecard_id   uuid references public.tas_screening_scorecard(id),
  overall_score  numeric,
  recommendation text check (recommendation in ('shortlist','reject','hold')),
  notes_en       text,
  screened_by    uuid references public.tas_user(id),
  screened_at    timestamptz not null default now(),
  status         text not null default 'draft' check (status in ('draft','submitted')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_screening is 'Screening record for an application. overall_score = weighted average of criterion scores.';
create index if not exists idx_tas_screening_application on public.tas_screening(application_id);
create index if not exists idx_tas_screening_recommendation on public.tas_screening(recommendation);
create index if not exists idx_tas_screening_screened_by on public.tas_screening(screened_by);

-- Individual criterion scores.
create table if not exists public.tas_screening_score (
  id           uuid primary key default gen_random_uuid(),
  screening_id uuid not null references public.tas_screening(id) on delete cascade,
  criterion_id uuid not null references public.tas_screening_criterion(id),
  score        numeric,
  note         text,
  unique (screening_id, criterion_id)
);
comment on table public.tas_screening_score is 'Individual criterion score within a screening.';
create index if not exists idx_tas_screening_score_screening on public.tas_screening_score(screening_id);

-- =============================================================================
-- 2. updated_at TRIGGERS (tables with audit cols)
-- =============================================================================
drop trigger if exists trg_tas_screening_scorecard_updated_at on public.tas_screening_scorecard;
create trigger trg_tas_screening_scorecard_updated_at before update on public.tas_screening_scorecard
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_screening_criterion_updated_at on public.tas_screening_criterion;
create trigger trg_tas_screening_criterion_updated_at before update on public.tas_screening_criterion
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_screening_updated_at on public.tas_screening;
create trigger trg_tas_screening_updated_at before update on public.tas_screening
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (authenticated SELECT; writes via RPC/service-role)
-- =============================================================================
alter table public.tas_screening_scorecard enable row level security;
alter table public.tas_screening_criterion enable row level security;
alter table public.tas_screening           enable row level security;
alter table public.tas_screening_score     enable row level security;

-- Scorecard + criterion: authenticated read; config writes service-role (M3.1).
drop policy if exists tas_screening_scorecard_select_auth on public.tas_screening_scorecard;
create policy tas_screening_scorecard_select_auth on public.tas_screening_scorecard
  for select to authenticated using (true);

drop policy if exists tas_screening_criterion_select_auth on public.tas_screening_criterion;
create policy tas_screening_criterion_select_auth on public.tas_screening_criterion
  for select to authenticated using (true);

-- Screening + score: authenticated read; writes via the SECURITY DEFINER RPCs
-- (create_screening / save_screening_scores / submit_screening). No write policy
-- => table-level writes are service-role only until M3.1.
drop policy if exists tas_screening_select_auth on public.tas_screening;
create policy tas_screening_select_auth on public.tas_screening
  for select to authenticated using (true);

drop policy if exists tas_screening_score_select_auth on public.tas_screening_score;
create policy tas_screening_score_select_auth on public.tas_screening_score
  for select to authenticated using (true);

-- =============================================================================
-- 4. GRANTS
-- =============================================================================
grant select on public.tas_screening_scorecard to authenticated;
grant select on public.tas_screening_criterion to authenticated;
grant select on public.tas_screening           to authenticated;
grant select on public.tas_screening_score     to authenticated;

-- =============================================================================
-- 5. SEED (idempotent; ON CONFLICT targets match plain unique indexes — rubric 12)
-- =============================================================================

-- Default scorecard (code unique → plain index).
insert into public.tas_screening_scorecard (code, name_en, name_ar, description_en, description_ar) values
  ('DEFAULT_SCREENING', 'Default Screening', 'الفرز الافتراضي',
   'Default configurable screening scorecard.', 'بطاقة فرز افتراضية قابلة للتهيئة.')
on conflict (code) do nothing;

-- Four sample criteria ((scorecard_id, code) unique → plain index).
insert into public.tas_screening_criterion (scorecard_id, code, name_en, name_ar, weight, max_score, sort_order)
select sc.id, v.code, v.name_en, v.name_ar, v.weight, 5, v.sort_order
from public.tas_screening_scorecard sc
cross join (values
  ('relevant_experience', 'Relevant Experience',   'الخبرة ذات الصلة',   2::numeric, 10),
  ('qualifications',      'Qualifications Match',   'مطابقة المؤهلات',    1::numeric, 20),
  ('communication',       'Communication',          'التواصل',            1::numeric, 30),
  ('availability',        'Availability',           'الجاهزية',           1::numeric, 40)
) as v(code, name_en, name_ar, weight, sort_order)
where sc.code = 'DEFAULT_SCREENING'
on conflict (scorecard_id, code) do nothing;

-- =============================================================================
-- End of schema/seed. RPCs follow in 20260619140001_m1_6_screening_rpc.sql
-- =============================================================================
