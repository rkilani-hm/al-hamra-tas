-- =============================================================================
-- Al Hamra TAS — Module M1.7: Interview Management
-- =============================================================================
-- Schedule + manage interviews for shortlisted candidates: rounds, panels,
-- per-interviewer scorecards (REUSING M1.6 tas_screening_scorecard/criterion —
-- NO duplicate scorecard tables), panel aggregation, and an outcome that drives
-- the M1.5 pipeline via the EXISTING move_application_stage/set_application_status.
-- NOT a workflow engine. M365 (Outlook/Teams via Graph) is a DORMANT adapter:
-- in-app scheduling works now; calendar/Teams creation activates when configured,
-- and degrades to calendar_status='skipped' (never 'failed', never a crash).
--
-- Conventions (M0.x/M1.x): UUID PKs, audit cols + tas_set_updated_at() trigger,
-- bilingual user-facing fields, status checks, FK indexes. Reuses M0.4 notify(),
-- M0.2 tas_lookup, the M1.2/M1.5 year-aware counter pattern, M1.6 scorecards.
--
-- RLS posture (M1.7; per-role tightening M3.1): authenticated SELECT on all 4
-- (scope/self narrowed in M3.1); writes via SECURITY DEFINER RPCs granted to
-- authenticated (recruiter schedules; panelist scores own) — table-level writes
-- service-role. No storage bucket SQL. No recursive CTEs. ON CONFLICT targets
-- match plain unique indexes (rubric 12).
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- An interview event for an application.
create table if not exists public.tas_interview (
  id              uuid primary key default gen_random_uuid(),
  reference       text unique,
  application_id  uuid not null references public.tas_application(id) on delete cascade,
  round_type      text,
  scheduled_at    timestamptz,
  duration_min    int not null default 60,
  mode            text not null default 'onsite' check (mode in ('onsite','teams','phone')),
  location        text,
  status          text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  calendar_status text not null default 'none' check (calendar_status in ('none','skipped','created','failed')),
  outlook_event_id text,
  teams_join_url  text,
  outcome         text check (outcome in ('proceed','reject','hold')),
  scorecard_id    uuid references public.tas_screening_scorecard(id),
  scheduled_by    uuid references public.tas_user(id),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
comment on table public.tas_interview is 'Interview event for an application. calendar_status=skipped when M365 unconfigured (default state).';
create index if not exists idx_tas_interview_application on public.tas_interview(application_id, status);
create index if not exists idx_tas_interview_scheduled on public.tas_interview(scheduled_at);

-- Panel members on an interview.
create table if not exists public.tas_interview_panelist (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.tas_interview(id) on delete cascade,
  user_id      uuid not null references public.tas_user(id),
  role         text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (interview_id, user_id)
);
comment on table public.tas_interview_panelist is 'Panel members assigned to an interview.';
create index if not exists idx_tas_interview_panelist_user on public.tas_interview_panelist(user_id);

-- Per-panelist scorecard result (criterion details in tas_interview_score_detail).
create table if not exists public.tas_interview_score (
  id               uuid primary key default gen_random_uuid(),
  interview_id     uuid not null references public.tas_interview(id) on delete cascade,
  panelist_user_id uuid references public.tas_user(id),
  scorecard_id     uuid references public.tas_screening_scorecard(id),
  overall_score    numeric,
  recommendation   text check (recommendation in ('proceed','reject','hold')),
  notes_en         text,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  unique (interview_id, panelist_user_id)
);
comment on table public.tas_interview_score is 'One scorecard result per panelist per interview. overall_score = weighted average of criterion scores.';
create index if not exists idx_tas_interview_score_interview on public.tas_interview_score(interview_id);

-- Individual criterion scores within a panelist's interview scorecard.
create table if not exists public.tas_interview_score_detail (
  id                 uuid primary key default gen_random_uuid(),
  interview_score_id uuid not null references public.tas_interview_score(id) on delete cascade,
  criterion_id       uuid not null references public.tas_screening_criterion(id),
  score              numeric,
  note               text,
  unique (interview_score_id, criterion_id)
);
comment on table public.tas_interview_score_detail is 'Individual criterion score within an interview scorecard (reuses M1.6 criteria).';
create index if not exists idx_tas_interview_score_detail on public.tas_interview_score_detail(interview_score_id);

-- =============================================================================
-- 2. REFERENCE GENERATION — INT-YYYY-NNNN (year-aware atomic counter)
-- =============================================================================
create table if not exists public.tas_interview_counter (
  fiscal_year int primary key,
  last_no     int not null default 0
);
comment on table public.tas_interview_counter is 'Per-year counter backing generate_interview_ref() (INT-YYYY-NNNN).';

create or replace function public.generate_interview_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_no   int;
begin
  insert into public.tas_interview_counter (fiscal_year, last_no)
  values (v_year, 1)
  on conflict (fiscal_year)
  do update set last_no = public.tas_interview_counter.last_no + 1
  returning last_no into v_no;
  return 'INT-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- Auto-assign reference on interview insert if not provided.
create or replace function public.tas_interview_set_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null then
    new.reference := public.generate_interview_ref();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tas_interview_set_ref on public.tas_interview;
create trigger trg_tas_interview_set_ref before insert on public.tas_interview
  for each row execute function public.tas_interview_set_ref();

-- =============================================================================
-- 3. updated_at TRIGGERS (tables with audit cols)
-- =============================================================================
drop trigger if exists trg_tas_interview_updated_at on public.tas_interview;
create trigger trg_tas_interview_updated_at before update on public.tas_interview
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_interview_panelist_updated_at on public.tas_interview_panelist;
create trigger trg_tas_interview_panelist_updated_at before update on public.tas_interview_panelist
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_interview_score_updated_at on public.tas_interview_score;
create trigger trg_tas_interview_score_updated_at before update on public.tas_interview_score
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (authenticated SELECT; writes via RPC/service-role)
-- =============================================================================
alter table public.tas_interview              enable row level security;
alter table public.tas_interview_panelist     enable row level security;
alter table public.tas_interview_score        enable row level security;
alter table public.tas_interview_score_detail enable row level security;
alter table public.tas_interview_counter      enable row level security; -- internal; no policy (counter touched only by generate_interview_ref)

-- authenticated SELECT (M3.1 narrows to scope/self). Writes via the SECURITY
-- DEFINER RPCs (schedule_interview / submit_interview_score /
-- record_interview_outcome / reschedule_interview / cancel_interview) — no write
-- policy => table-level writes are service-role only until M3.1.
drop policy if exists tas_interview_select_auth on public.tas_interview;
create policy tas_interview_select_auth on public.tas_interview
  for select to authenticated using (true);

drop policy if exists tas_interview_panelist_select_auth on public.tas_interview_panelist;
create policy tas_interview_panelist_select_auth on public.tas_interview_panelist
  for select to authenticated using (true);

drop policy if exists tas_interview_score_select_auth on public.tas_interview_score;
create policy tas_interview_score_select_auth on public.tas_interview_score
  for select to authenticated using (true);

drop policy if exists tas_interview_score_detail_select_auth on public.tas_interview_score_detail;
create policy tas_interview_score_detail_select_auth on public.tas_interview_score_detail
  for select to authenticated using (true);

-- =============================================================================
-- 5. GRANTS
-- =============================================================================
grant select on public.tas_interview              to authenticated;
grant select on public.tas_interview_panelist     to authenticated;
grant select on public.tas_interview_score        to authenticated;
grant select on public.tas_interview_score_detail to authenticated;

-- =============================================================================
-- 6. SEED (idempotent; ON CONFLICT targets match plain unique indexes — rubric 12)
-- =============================================================================

-- 6a. interview_round lookups (bilingual) — unique (lookup_type, code).
insert into public.tas_lookup (lookup_type, code, name_en, name_ar, sort_order) values
  ('interview_round', 'phone_screen', 'Phone Screen', 'مقابلة هاتفية',  10),
  ('interview_round', 'technical',    'Technical',    'تقنية',          20),
  ('interview_round', 'panel',        'Panel',        'لجنة',           30),
  ('interview_round', 'hr',           'HR',           'الموارد البشرية', 40),
  ('interview_round', 'final',        'Final',        'نهائية',         50)
on conflict (lookup_type, code) do nothing;

-- 6b. interview.* in_app notification templates (bilingual) — unique
--     (type_code, channel, version). Fired via notify() inside the RPCs.
insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('interview.scheduled', 'in_app',
   'Interview scheduled: {{reference}}',
   'تم تحديد موعد المقابلة: {{reference}}',
   'An interview ({{reference}}) for {{candidate}} is scheduled for {{datetime}} ({{mode}}).',
   'تم تحديد موعد مقابلة ({{reference}}) لـ {{candidate}} في {{datetime}} ({{mode}}).',
   '["reference","candidate","datetime","mode"]', 'active', 1),

  ('interview.rescheduled', 'in_app',
   'Interview rescheduled: {{reference}}',
   'تم تغيير موعد المقابلة: {{reference}}',
   'The interview ({{reference}}) for {{candidate}} was moved to {{datetime}} ({{mode}}).',
   'تم نقل مقابلة ({{reference}}) لـ {{candidate}} إلى {{datetime}} ({{mode}}).',
   '["reference","candidate","datetime","mode"]', 'active', 1),

  ('interview.cancelled', 'in_app',
   'Interview cancelled: {{reference}}',
   'تم إلغاء المقابلة: {{reference}}',
   'The interview ({{reference}}) for {{candidate}} on {{datetime}} was cancelled.',
   'تم إلغاء مقابلة ({{reference}}) لـ {{candidate}} بتاريخ {{datetime}}.',
   '["reference","candidate","datetime","mode"]', 'active', 1),

  ('interview.completed', 'in_app',
   'Interview completed: {{reference}}',
   'اكتملت المقابلة: {{reference}}',
   'The interview ({{reference}}) for {{candidate}} is complete.',
   'اكتملت مقابلة ({{reference}}) لـ {{candidate}}.',
   '["reference","candidate","datetime","mode"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- 6c. Default interview scorecard: REUSE M1.6 DEFAULT_SCREENING. No new scorecard
--     row is created here — interviews point scorecard_id at the existing one.

-- =============================================================================
-- End of schema/seed. RPCs follow in 20260619150001_m1_7_interviews_rpc.sql
-- =============================================================================
