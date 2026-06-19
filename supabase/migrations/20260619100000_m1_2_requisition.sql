-- =============================================================================
-- Al Hamra TAS — Module M1.2: Job Requisition Management
-- =============================================================================
-- First recruitment-lifecycle module. CONSUMES the foundation (M0.1–M0.5) — it
-- owns the requisition record, its lifecycle, and a thin budgeted-position
-- concept; everything else is integration (M0.3 workflow, M0.4 notify, M0.5
-- audit). JD content is FROZEN into jd_snapshot_json at submit time. Requisition
-- status is derive-on-read + persist-on-terminal from the linked workflow
-- instance (the M0.3 engine is NOT modified to write back).
--
-- Conventions (M0.x): UUID PKs, audit cols + tas_set_updated_at() trigger,
-- bilingual where user-facing, status checks, FK/lookup indexes.
--
-- RLS posture (M1.2; per-role tightening in M3.1):
--   * tas_requisition / tas_budgeted_position / tas_requisition_event:
--     authenticated SELECT (org-scoped/self); writes service-role — EXCEPT
--     authenticated INSERT of an own draft requisition (requested_by = caller).
--   * Status-transition writes happen only through SECURITY DEFINER RPCs.
-- No SQL references the storage bucket table. Recursive CTEs use one UNION.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Budgeted-position (light M1.1): warn-only headcount budget per position+org.
create table if not exists public.tas_budgeted_position (
  id             uuid primary key default gen_random_uuid(),
  job_position_id uuid not null references public.tas_job_position(id) on delete cascade,
  entity_id      uuid not null references public.tas_entity(id) on delete cascade,
  branch_id      uuid references public.tas_branch(id) on delete set null,
  department_id  uuid references public.tas_department(id) on delete set null,
  budgeted_count int not null default 0,
  filled_count   int not null default 0,
  fiscal_year    text,
  status         text not null default 'active' check (status in ('active','inactive')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_budgeted_position is 'Light budgeted headcount per position+org (warn-only; no quota logic until Phase 3).';
create index if not exists idx_tas_budgeted_position_pos_dept on public.tas_budgeted_position(job_position_id, department_id);
create index if not exists idx_tas_budgeted_position_entity   on public.tas_budgeted_position(entity_id);

-- Requisition record + lifecycle.
create table if not exists public.tas_requisition (
  id                   uuid primary key default gen_random_uuid(),
  reference            text unique,
  title_en             text,
  title_ar             text,
  job_position_id      uuid not null references public.tas_job_position(id),
  jd_template_id       uuid references public.tas_jd_template(id),
  jd_snapshot_json     jsonb not null default '{}',
  entity_id            uuid not null references public.tas_entity(id),
  branch_id            uuid references public.tas_branch(id),
  department_id        uuid references public.tas_department(id),
  headcount            int not null default 1,
  employment_type      text,
  contract_type        text,
  target_start_date    date,
  salary_min           numeric,
  salary_max           numeric,
  budgeted_position_id uuid references public.tas_budgeted_position(id),
  justification_en     text,
  status               text not null default 'draft'
                         check (status in ('draft','submitted','in_approval','approved',
                                           'published','on_hold','cancelled','closed')),
  workflow_instance_id uuid references public.tas_workflow_instance(id),
  requested_by         uuid references public.tas_user(id),
  created_at           timestamptz not null default now(),
  created_by           uuid,
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);
comment on table public.tas_requisition is 'Job requisition. jd_snapshot_json frozen at submit; status derived-on-read from the linked workflow instance.';
create index if not exists idx_tas_requisition_status_dept on public.tas_requisition(status, department_id);
create index if not exists idx_tas_requisition_requested  on public.tas_requisition(requested_by);
create index if not exists idx_tas_requisition_reference  on public.tas_requisition(reference);
create index if not exists idx_tas_requisition_instance   on public.tas_requisition(workflow_instance_id);
create index if not exists idx_tas_requisition_position   on public.tas_requisition(job_position_id);

-- Append-only requisition lifecycle events (separate from the generic audit log).
create table if not exists public.tas_requisition_event (
  id             uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.tas_requisition(id) on delete cascade,
  event_type     text,
  from_status    text,
  to_status      text,
  actor_user_id  uuid references public.tas_user(id),
  detail_json    jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
comment on table public.tas_requisition_event is 'Append-only requisition lifecycle events.';
create index if not exists idx_tas_requisition_event_req on public.tas_requisition_event(requisition_id, created_at);

-- =============================================================================
-- 2. updated_at TRIGGERS
-- =============================================================================
drop trigger if exists trg_tas_budgeted_position_updated_at on public.tas_budgeted_position;
create trigger trg_tas_budgeted_position_updated_at before update on public.tas_budgeted_position
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_requisition_updated_at on public.tas_requisition;
create trigger trg_tas_requisition_updated_at before update on public.tas_requisition
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 3. REFERENCE GENERATION — REQ-YYYY-NNNN (year-aware, atomic counter)
-- =============================================================================
-- Year-aware sequence backing: an atomic per-year counter. NNNN resets each year.
create table if not exists public.tas_requisition_counter (
  fiscal_year int primary key,
  last_no     int not null default 0
);
comment on table public.tas_requisition_counter is 'Per-year counter backing generate_requisition_ref() (REQ-YYYY-NNNN).';

create or replace function public.generate_requisition_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_no   int;
begin
  insert into public.tas_requisition_counter (fiscal_year, last_no)
  values (v_year, 1)
  on conflict (fiscal_year)
  do update set last_no = public.tas_requisition_counter.last_no + 1
  returning last_no into v_no;

  return 'REQ-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- Auto-assign a reference on draft creation if the client didn't set one.
create or replace function public.tas_requisition_set_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null then
    new.reference := public.generate_requisition_ref();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tas_requisition_set_ref on public.tas_requisition;
create trigger trg_tas_requisition_set_ref before insert on public.tas_requisition
  for each row execute function public.tas_requisition_set_ref();

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================
alter table public.tas_budgeted_position  enable row level security;
alter table public.tas_requisition        enable row level security;
alter table public.tas_requisition_event  enable row level security;
-- Internal counter table: RLS on, NO policy/grant — reachable only via the
-- SECURITY DEFINER generate_requisition_ref() (which runs as owner).
alter table public.tas_requisition_counter enable row level security;

-- Budgeted positions: authenticated read; writes service-role.
drop policy if exists tas_budgeted_position_select_auth on public.tas_budgeted_position;
create policy tas_budgeted_position_select_auth on public.tas_budgeted_position
  for select to authenticated using (true);

-- Requisitions: authenticated read (org-scoped/self — tightened M3.1); INSERT of
-- an OWN draft only; all other writes service-role (via RPCs).
drop policy if exists tas_requisition_select_auth on public.tas_requisition;
create policy tas_requisition_select_auth on public.tas_requisition
  for select to authenticated using (true);

drop policy if exists tas_requisition_insert_own_draft on public.tas_requisition;
create policy tas_requisition_insert_own_draft on public.tas_requisition
  for insert to authenticated with check (
    status = 'draft'
    and requested_by in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

-- Requisition events: authenticated read; writes service-role.
drop policy if exists tas_requisition_event_select_auth on public.tas_requisition_event;
create policy tas_requisition_event_select_auth on public.tas_requisition_event
  for select to authenticated using (true);

-- =============================================================================
-- 5. GRANTS (per-role tightening in M3.1)
-- =============================================================================
grant select on public.tas_budgeted_position to authenticated;
grant select, insert on public.tas_requisition to authenticated;  -- insert = own draft (RLS)
grant select on public.tas_requisition_event  to authenticated;

-- =============================================================================
-- 6. SEED (idempotent)
-- =============================================================================

-- 6a. ONE active 'requisition' workflow definition (2 role-based steps).
insert into public.tas_workflow_definition (request_type, version, name_en, name_ar, status)
values ('requisition', 1, 'Job Requisition Approval', 'اعتماد طلب التوظيف', 'active')
on conflict (request_type, version) do nothing;

-- Step 1 — Approver (role APPROVER, seeded in M0.1). on_reject 'return' (back to requester).
insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 1, 'Manager Review', 'مراجعة المدير', 'role', '{"role_code":"APPROVER"}'::jsonb, 1, 'return'
from public.tas_workflow_definition d
where d.request_type = 'requisition' and d.version = 1
on conflict (definition_id, step_no) do nothing;

-- Step 2 — HR Manager. on_reject 'stop' (reject the requisition).
insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 2, 'HR Approval', 'اعتماد الموارد البشرية', 'role', '{"role_code":"HR_MANAGER"}'::jsonb, 1, 'stop'
from public.tas_workflow_definition d
where d.request_type = 'requisition' and d.version = 1
on conflict (definition_id, step_no) do nothing;

-- 6a2. Minimal SAMPLE org chain. Entities are normally created via the M0.2 UI,
--      but M1.2's sample budgeted positions (and the requisition form's org
--      cascade) need at least one entity to work with. Clearly sample; deletable.
insert into public.tas_entity (code, name_en, name_ar, status)
values ('SAMPLE_ENT', 'Sample Entity', 'كيان تجريبي', 'active')
on conflict (code) do nothing;

insert into public.tas_branch (entity_id, code, name_en, name_ar, status)
select e.id, 'SAMPLE_BR', 'Sample Branch', 'فرع تجريبي', 'active'
from public.tas_entity e where e.code = 'SAMPLE_ENT'
on conflict (entity_id, code) do nothing;

insert into public.tas_department (branch_id, code, name_en, name_ar, status)
select b.id, 'SAMPLE_DEPT', 'Sample Department', 'قسم تجريبي', 'active'
from public.tas_branch b where b.code = 'SAMPLE_BR'
on conflict (branch_id, code) do nothing;

-- 6b. SAMPLE budgeted positions for the M0.2 sample positions (now an entity
--     exists from 6a2). Clearly sample data.
insert into public.tas_budgeted_position
  (job_position_id, entity_id, department_id, budgeted_count, filled_count, fiscal_year, status)
select p.id, e.id, null, 2, 1, extract(year from now())::text, 'active'
from public.tas_job_position p
cross join lateral (select id from public.tas_entity order by code limit 1) e
where p.code in ('POS_HR_OFFICER', 'POS_ACCOUNTANT')
  and not exists (
    select 1 from public.tas_budgeted_position b
    where b.job_position_id = p.id and b.entity_id = e.id and b.department_id is null
  );

-- 6c. Requester-facing notification templates (in_app, bilingual). The workflow
--     engine already notifies approvers; these cover requester outcomes.
insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('requisition.submitted', 'in_app',
   'Requisition submitted: {{reference}}',
   'تم تقديم الطلب: {{reference}}',
   'Your requisition {{reference}} — {{title}} — was submitted for approval.',
   'تم تقديم طلبك {{reference}} — {{title}} — للاعتماد.',
   '["reference","title","status"]', 'active', 1),
  ('requisition.approved', 'in_app',
   'Requisition approved: {{reference}}',
   'تم اعتماد الطلب: {{reference}}',
   'Your requisition {{reference}} — {{title}} — has been approved.',
   'تمت الموافقة على طلبك {{reference}} — {{title}}.',
   '["reference","title","status"]', 'active', 1),
  ('requisition.rejected', 'in_app',
   'Requisition rejected: {{reference}}',
   'تم رفض الطلب: {{reference}}',
   'Your requisition {{reference}} — {{title}} — was rejected.',
   'تم رفض طلبك {{reference}} — {{title}}.',
   '["reference","title","status"]', 'active', 1),
  ('requisition.changes_requested', 'in_app',
   'Changes requested: {{reference}}',
   'مطلوب تعديلات: {{reference}}',
   'Your requisition {{reference}} — {{title}} — was returned for changes.',
   'أُعيد طلبك {{reference}} — {{title}} — لإجراء تعديلات.',
   '["reference","title","status"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- =============================================================================
-- End of schema/seed. RPCs follow in 20260619100001_m1_2_requisition_rpc.sql
-- =============================================================================
