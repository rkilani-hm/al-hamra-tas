-- =============================================================================
-- Al Hamra TAS — Module M1.9: Offer Management (ATS MVP capstone)
-- =============================================================================
-- Create a job offer, route it through the M0.3 WORKFLOW ENGINE (second consumer
-- after M1.2 requisition — submit_workflow('offer', ...)), generate a frozen
-- bilingual offer letter (snapshot), capture recruiter-recorded acceptance/decline,
-- and on acceptance advance the M1.5 application + flag onboarding-ready.
--
-- The seeded 'offer' workflow definition includes a CONDITIONAL high-salary step
-- (salary_amount >= 2000) — the first real exercise of the engine's eval_condition.
-- E-sign is a DORMANT adapter (esign_status='skipped' until a provider is configured).
--
-- Offer is SENSITIVE: stricter write posture than M1.5/M1.6 (matches M1.2) —
-- authenticated SELECT + own-draft INSERT; submit/issue/respond/transition via
-- service-role-guarded SECURITY DEFINER RPCs (revoked from public, M3.1).
--
-- Conventions: UUID PKs, audit cols + tas_set_updated_at() trigger, bilingual
-- user-facing fields, status checks, FK indexes. No storage bucket SQL. No
-- recursive CTEs. ON CONFLICT targets match plain unique indexes (rubric 12).
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

create table if not exists public.tas_offer (
  id                    uuid primary key default gen_random_uuid(),
  reference             text unique,
  application_id        uuid not null references public.tas_application(id) on delete cascade,
  candidate_id          uuid not null references public.tas_candidate(id),
  job_position_id       uuid references public.tas_job_position(id),
  job_grade_id          uuid references public.tas_job_grade(id),
  salary_amount         numeric,
  currency              text not null default 'KWD',
  salary_components_json jsonb not null default '{}',
  employment_type       text,
  contract_type         text,
  start_date            date,
  probation_months      int,
  terms_en              text,
  terms_ar              text,
  expiry_date           date,
  letter_template_id    uuid,
  letter_snapshot_json  jsonb not null default '{}',
  status                text not null default 'draft'
                          check (status in ('draft','in_approval','approved','issued',
                                            'accepted','declined','expired','cancelled')),
  workflow_instance_id  uuid references public.tas_workflow_instance(id),
  esign_status          text not null default 'none'
                          check (esign_status in ('none','pending','signed','skipped','failed')),
  accepted_at           timestamptz,
  declined_reason       text,
  onboarding_ready      boolean not null default false,
  created_by            uuid references public.tas_user(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid
);
comment on table public.tas_offer is 'Job offer + lifecycle. Approval via M0.3 workflow; letter_snapshot_json frozen at issue.';
create index if not exists idx_tas_offer_application on public.tas_offer(application_id, status);
create index if not exists idx_tas_offer_candidate   on public.tas_offer(candidate_id);
create index if not exists idx_tas_offer_instance    on public.tas_offer(workflow_instance_id);
create index if not exists idx_tas_offer_reference   on public.tas_offer(reference);

-- Append-only offer lifecycle events.
create table if not exists public.tas_offer_event (
  id            uuid primary key default gen_random_uuid(),
  offer_id      uuid not null references public.tas_offer(id) on delete cascade,
  event_type    text,
  from_status   text,
  to_status     text,
  actor_user_id uuid references public.tas_user(id),
  detail_json   jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
comment on table public.tas_offer_event is 'Append-only offer lifecycle event log.';
create index if not exists idx_tas_offer_event_offer on public.tas_offer_event(offer_id, created_at);

-- =============================================================================
-- 2. REFERENCE GENERATION — OFF-YYYY-NNNN (year-aware atomic counter)
-- =============================================================================
create table if not exists public.tas_offer_counter (
  fiscal_year int primary key,
  last_no     int not null default 0
);
comment on table public.tas_offer_counter is 'Per-year counter backing generate_offer_ref() (OFF-YYYY-NNNN).';

create or replace function public.generate_offer_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_no   int;
begin
  insert into public.tas_offer_counter (fiscal_year, last_no)
  values (v_year, 1)
  on conflict (fiscal_year)
  do update set last_no = public.tas_offer_counter.last_no + 1
  returning last_no into v_no;
  return 'OFF-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- Auto-assign reference on insert if not provided.
create or replace function public.tas_offer_set_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null then
    new.reference := public.generate_offer_ref();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tas_offer_set_ref on public.tas_offer;
create trigger trg_tas_offer_set_ref before insert on public.tas_offer
  for each row execute function public.tas_offer_set_ref();

-- =============================================================================
-- 3. updated_at TRIGGER
-- =============================================================================
drop trigger if exists trg_tas_offer_updated_at on public.tas_offer;
create trigger trg_tas_offer_updated_at before update on public.tas_offer
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (sensitive: authenticated SELECT + own-draft INSERT;
--    submit/issue/respond/transition writes via service-role RPCs — M3.1)
-- =============================================================================
alter table public.tas_offer         enable row level security;
alter table public.tas_offer_event   enable row level security;
alter table public.tas_offer_counter enable row level security; -- internal; no policy (counter touched only by generate_offer_ref)

-- Offer: authenticated SELECT (M3.1 narrows to scope/self).
drop policy if exists tas_offer_select_auth on public.tas_offer;
create policy tas_offer_select_auth on public.tas_offer
  for select to authenticated using (true);

-- Offer: authenticated may INSERT an own draft (created_by = caller, status draft).
drop policy if exists tas_offer_insert_own_draft on public.tas_offer;
create policy tas_offer_insert_own_draft on public.tas_offer
  for insert to authenticated with check (
    status = 'draft'
    and created_by in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

-- Offer events: authenticated SELECT; writes via the RPCs (service-role).
drop policy if exists tas_offer_event_select_auth on public.tas_offer_event;
create policy tas_offer_event_select_auth on public.tas_offer_event
  for select to authenticated using (true);

-- =============================================================================
-- 5. GRANTS
-- =============================================================================
grant select, insert on public.tas_offer to authenticated; -- INSERT gated to own draft by RLS
grant select on public.tas_offer_event    to authenticated;

-- =============================================================================
-- 6. SEED (idempotent; ON CONFLICT targets match plain unique indexes — rubric 12)
-- =============================================================================

-- 6a. ONE active 'offer' workflow definition (M0.3 second consumer).
insert into public.tas_workflow_definition (request_type, version, name_en, name_ar, status)
values ('offer', 1, 'Job Offer Approval', 'اعتماد عرض العمل', 'active')
on conflict (request_type, version) do nothing;

-- Step 1 — Hiring Manager (role HIRING_MANAGER, seeded M0.1). on_reject 'return'.
insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 1, 'Hiring Manager Review', 'مراجعة مدير التوظيف', 'role', '{"role_code":"HIRING_MANAGER"}'::jsonb, 1, 'return'
from public.tas_workflow_definition d
where d.request_type = 'offer' and d.version = 1
on conflict (definition_id, step_no) do nothing;

-- Step 2 — HR Manager. on_reject 'stop'.
insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 2, 'HR Approval', 'اعتماد الموارد البشرية', 'role', '{"role_code":"HR_MANAGER"}'::jsonb, 1, 'stop'
from public.tas_workflow_definition d
where d.request_type = 'offer' and d.version = 1
on conflict (definition_id, step_no) do nothing;

-- Step 3 — CONDITIONAL high-salary approval (role APPROVER, stand-in for Finance/GM).
-- Included only when salary_amount >= 2000 (KWD); engine skips it otherwise via
-- eval_condition. condition_json matches eval_condition's {field, op, value} shape.
insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, condition_json, quorum, on_reject)
select d.id, 3, 'High-Salary Approval', 'اعتماد الراتب المرتفع', 'role', '{"role_code":"APPROVER"}'::jsonb,
       '{"field":"salary_amount","op":">=","value":2000}'::jsonb, 1, 'stop'
from public.tas_workflow_definition d
where d.request_type = 'offer' and d.version = 1
on conflict (definition_id, step_no) do nothing;

-- 6b. 6 bilingual in_app notification templates — unique (type_code, channel, version).
insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('offer.submitted', 'in_app',
   'Offer submitted: {{reference}}', 'تم تقديم العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} ({{salary}}) was submitted for approval.',
   'تم تقديم العرض {{reference}} لـ {{candidate}} ({{salary}}) للاعتماد.',
   '["reference","candidate","salary","status"]', 'active', 1),

  ('offer.approved', 'in_app',
   'Offer approved: {{reference}}', 'تم اعتماد العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} has been approved and can be issued.',
   'تم اعتماد العرض {{reference}} لـ {{candidate}} ويمكن إصداره.',
   '["reference","candidate","salary","status"]', 'active', 1),

  ('offer.rejected', 'in_app',
   'Offer rejected: {{reference}}', 'تم رفض العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} was rejected in approval.',
   'تم رفض العرض {{reference}} لـ {{candidate}} أثناء الاعتماد.',
   '["reference","candidate","salary","status"]', 'active', 1),

  ('offer.issued', 'in_app',
   'Offer issued: {{reference}}', 'تم إصدار العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} ({{salary}}) has been issued.',
   'تم إصدار العرض {{reference}} لـ {{candidate}} ({{salary}}).',
   '["reference","candidate","salary","status"]', 'active', 1),

  ('offer.accepted', 'in_app',
   'Offer accepted: {{reference}}', 'تم قبول العرض: {{reference}}',
   '{{candidate}} accepted offer {{reference}}. Onboarding can begin.',
   'قبل {{candidate}} العرض {{reference}}. يمكن بدء الإعداد الوظيفي.',
   '["reference","candidate","salary","status"]', 'active', 1),

  ('offer.declined', 'in_app',
   'Offer declined: {{reference}}', 'تم رفض العرض من المرشح: {{reference}}',
   '{{candidate}} declined offer {{reference}}.',
   'رفض {{candidate}} العرض {{reference}}.',
   '["reference","candidate","salary","status"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- 6c. Default offer letter: NO new template table. issue_offer builds
--     letter_snapshot_json from offer fields + a bilingual boilerplate when
--     letter_template_id is null (see 20260619200001_m1_9_offers_rpc.sql).

-- =============================================================================
-- End of schema/seed. RPCs follow in 20260619200001_m1_9_offers_rpc.sql
-- =============================================================================
