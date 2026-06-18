-- =============================================================================
-- Al Hamra TAS — Module M0.3: Workflow & Approval Engine (FULL v1)
-- =============================================================================
-- A configurable, Kuwait-org-hierarchy-aware approval engine any module can call.
-- Features: conditional steps, quorum (N-of-M), SLA/escalation, delegation-aware
-- routing, full audit. Approvers are SNAPSHOT-resolved at step entry into task rows.
-- Core transitions run as SECURITY DEFINER Postgres RPCs (atomic).
--
-- Conventions (same as M0.1/M0.2): UUID PKs, audit cols + tas_set_updated_at()
-- trigger, bilingual name_en/name_ar, status checks, FK + lookup indexes.
--
-- -----------------------------------------------------------------------------
-- RLS posture (M0.3):
--   * tas_workflow_definition / tas_workflow_step: authenticated SELECT (config-
--     like, readable); writes service-role only.
--   * tas_workflow_instance / _task / _history / _event: authenticated SELECT
--     ONLY for rows pertaining to the caller (requester or task assignee); all
--     writes service-role only.
--   Full per-role policies are tightened in M3.1.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 0. Non-destructive ALTER: allow 'workflow' as a tas_access_audit event_type.
-- =============================================================================
alter table public.tas_access_audit
  drop constraint if exists tas_access_audit_event_type_check;
alter table public.tas_access_audit
  add constraint tas_access_audit_event_type_check
  check (event_type in ('signin','signout','role_change','scope_change',
                        'delegation','denied','deactivate','provision','workflow'));

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Workflow definition: a versioned approval flow for a request_type.
create table if not exists public.tas_workflow_definition (
  id           uuid primary key default gen_random_uuid(),
  request_type text not null,
  version      int not null default 1,
  name_en      text not null,
  name_ar      text not null,
  status       text not null default 'draft'
                 check (status in ('draft','active','archived')),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (request_type, version)
);
comment on table public.tas_workflow_definition is 'Versioned approval flow per request_type. One active version per request_type.';

-- Enforce a single active version per request_type.
create unique index if not exists uq_tas_workflow_active_per_type
  on public.tas_workflow_definition (request_type)
  where status = 'active';

-- Workflow step: an ordered approval stage within a definition.
create table if not exists public.tas_workflow_step (
  id                   uuid primary key default gen_random_uuid(),
  definition_id        uuid not null references public.tas_workflow_definition(id) on delete cascade,
  step_no              int not null,
  name_en              text not null,
  name_ar              text not null,
  approver_rule_type   text not null
                         check (approver_rule_type in ('role','hierarchy','named_user')),
  approver_rule_value  jsonb not null default '{}',
  condition_json       jsonb,
  quorum               int not null default 1,
  sla_hours            int,
  on_reject            text not null default 'stop'
                         check (on_reject in ('stop','return')),
  created_at           timestamptz not null default now(),
  created_by           uuid,
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  unique (definition_id, step_no)
);
comment on table public.tas_workflow_step is 'Ordered approval step. condition_json null = always applies. quorum = approvals needed.';
comment on column public.tas_workflow_step.approver_rule_value is 'role:{role_code} | hierarchy:{relative} | named_user:{user_id}';

-- Workflow instance: a live run of a definition for one request.
create table if not exists public.tas_workflow_instance (
  id                uuid primary key default gen_random_uuid(),
  definition_id     uuid not null references public.tas_workflow_definition(id),
  request_type      text not null,
  request_ref       text,
  requester_user_id uuid references public.tas_user(id),
  entity_id         uuid references public.tas_entity(id),
  branch_id         uuid references public.tas_branch(id),
  department_id     uuid references public.tas_department(id),
  status            text not null default 'in_progress'
                      check (status in ('in_progress','approved','rejected','returned','blocked')),
  current_step      int not null default 1,
  context_json      jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
comment on table public.tas_workflow_instance is 'Live approval run. context_json holds the request payload evaluated by conditions.';

-- Workflow task: a snapshot-resolved approval assignment for one approver at one step.
create table if not exists public.tas_workflow_task (
  id                  uuid primary key default gen_random_uuid(),
  instance_id         uuid not null references public.tas_workflow_instance(id) on delete cascade,
  step_no             int not null,
  assignee_user_id    uuid references public.tas_user(id),
  resolved_via        text not null default 'direct'
                        check (resolved_via in ('direct','delegation','reassign')),
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected','changes_requested',
                                          'reassigned','skipped','escalated')),
  decision_comment_en text,
  decision_comment_ar text,
  due_at              timestamptz,
  acted_at            timestamptz,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);
comment on table public.tas_workflow_task is 'Snapshot-resolved approver assignment. due_at from step SLA; acted_at when decided.';

-- Workflow history: append-only transition log.
create table if not exists public.tas_workflow_history (
  id             uuid primary key default gen_random_uuid(),
  instance_id    uuid not null references public.tas_workflow_instance(id) on delete cascade,
  step_no        int,
  actor_user_id  uuid references public.tas_user(id),
  action         text,
  from_status    text,
  to_status      text,
  comment        text,
  created_at     timestamptz not null default now()
);
comment on table public.tas_workflow_history is 'Append-only transition history for an instance.';

-- Workflow event: outbox for downstream consumers (M0.4 Outlook/Teams notifications).
create table if not exists public.tas_workflow_event (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references public.tas_workflow_instance(id) on delete cascade,
  event_type   text not null
                 check (event_type in ('task_created','step_advanced','instance_completed',
                                       'rejected','returned','escalated','blocked')),
  payload_json jsonb not null default '{}',
  consumed     boolean not null default false,
  created_at   timestamptz not null default now()
);
comment on table public.tas_workflow_event is 'Event outbox. M0.4 consumes these for Outlook/Teams notifications.';

-- =============================================================================
-- 2. INDEXES
-- =============================================================================
create index if not exists idx_tas_wf_step_def        on public.tas_workflow_step(definition_id);
create index if not exists idx_tas_wf_instance_def     on public.tas_workflow_instance(definition_id);
create index if not exists idx_tas_wf_instance_status  on public.tas_workflow_instance(status, request_type);
create index if not exists idx_tas_wf_instance_ref     on public.tas_workflow_instance(request_ref);
create index if not exists idx_tas_wf_instance_req     on public.tas_workflow_instance(requester_user_id);
create index if not exists idx_tas_wf_task_assignee    on public.tas_workflow_task(assignee_user_id, status);
create index if not exists idx_tas_wf_task_instance    on public.tas_workflow_task(instance_id, step_no);
create index if not exists idx_tas_wf_task_due         on public.tas_workflow_task(status, due_at);
create index if not exists idx_tas_wf_history_instance on public.tas_workflow_history(instance_id, created_at);
create index if not exists idx_tas_wf_event_consumed   on public.tas_workflow_event(consumed, created_at);

-- =============================================================================
-- 3. updated_at TRIGGERS (reuse public.tas_set_updated_at() from M0.1)
-- =============================================================================
drop trigger if exists trg_tas_wf_definition_updated_at on public.tas_workflow_definition;
create trigger trg_tas_wf_definition_updated_at before update on public.tas_workflow_definition
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_wf_step_updated_at on public.tas_workflow_step;
create trigger trg_tas_wf_step_updated_at before update on public.tas_workflow_step
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_wf_instance_updated_at on public.tas_workflow_instance;
create trigger trg_tas_wf_instance_updated_at before update on public.tas_workflow_instance
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_wf_task_updated_at on public.tas_workflow_task;
create trigger trg_tas_wf_task_updated_at before update on public.tas_workflow_task
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================
alter table public.tas_workflow_definition enable row level security;
alter table public.tas_workflow_step       enable row level security;
alter table public.tas_workflow_instance   enable row level security;
alter table public.tas_workflow_task       enable row level security;
alter table public.tas_workflow_history    enable row level security;
alter table public.tas_workflow_event      enable row level security;

-- Helper expression note: a caller's tas_user is matched by Entra oid / email
-- claim (same pattern as the M0.1 self-read policies). Writes have NO policy =>
-- service-role only until M3.1.

-- Definitions + steps: readable by any authenticated user (config-like).
drop policy if exists tas_wf_definition_select_auth on public.tas_workflow_definition;
create policy tas_wf_definition_select_auth on public.tas_workflow_definition
  for select to authenticated using (true);

drop policy if exists tas_wf_step_select_auth on public.tas_workflow_step;
create policy tas_wf_step_select_auth on public.tas_workflow_step
  for select to authenticated using (true);

-- Instance: visible to its requester, or to anyone with a task on it.
drop policy if exists tas_wf_instance_select_self on public.tas_workflow_instance;
create policy tas_wf_instance_select_self on public.tas_workflow_instance
  for select to authenticated using (
    requester_user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
    or id in (
      select tk.instance_id from public.tas_workflow_task tk
      where tk.assignee_user_id in (
        select u.id from public.tas_user u
        where u.entra_object_id = (auth.jwt() ->> 'oid')
           or u.email = nullif(auth.jwt() ->> 'email','')::citext
      )
    )
  );

-- Task: visible to its assignee (or the instance requester).
drop policy if exists tas_wf_task_select_self on public.tas_workflow_task;
create policy tas_wf_task_select_self on public.tas_workflow_task
  for select to authenticated using (
    assignee_user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
    or instance_id in (
      select i.id from public.tas_workflow_instance i
      where i.requester_user_id in (
        select u.id from public.tas_user u
        where u.entra_object_id = (auth.jwt() ->> 'oid')
           or u.email = nullif(auth.jwt() ->> 'email','')::citext
      )
    )
  );

-- History + event: visible if the caller can see the parent instance.
drop policy if exists tas_wf_history_select_self on public.tas_workflow_history;
create policy tas_wf_history_select_self on public.tas_workflow_history
  for select to authenticated using (
    instance_id in (
      select i.id from public.tas_workflow_instance i
      where i.requester_user_id in (
        select u.id from public.tas_user u
        where u.entra_object_id = (auth.jwt() ->> 'oid')
           or u.email = nullif(auth.jwt() ->> 'email','')::citext
      )
      or i.id in (
        select tk.instance_id from public.tas_workflow_task tk
        where tk.assignee_user_id in (
          select u.id from public.tas_user u
          where u.entra_object_id = (auth.jwt() ->> 'oid')
             or u.email = nullif(auth.jwt() ->> 'email','')::citext
        )
      )
    )
  );

drop policy if exists tas_wf_event_select_self on public.tas_workflow_event;
create policy tas_wf_event_select_self on public.tas_workflow_event
  for select to authenticated using (
    instance_id in (
      select i.id from public.tas_workflow_instance i
      where i.requester_user_id in (
        select u.id from public.tas_user u
        where u.entra_object_id = (auth.jwt() ->> 'oid')
           or u.email = nullif(auth.jwt() ->> 'email','')::citext
      )
      or i.id in (
        select tk.instance_id from public.tas_workflow_task tk
        where tk.assignee_user_id in (
          select u.id from public.tas_user u
          where u.entra_object_id = (auth.jwt() ->> 'oid')
             or u.email = nullif(auth.jwt() ->> 'email','')::citext
        )
      )
    )
  );

-- =============================================================================
-- 5. GRANTS (authenticated SELECT on the readable tables; writes via RPC/service-role)
-- =============================================================================
grant select on public.tas_workflow_definition to authenticated;
grant select on public.tas_workflow_step       to authenticated;
grant select on public.tas_workflow_instance   to authenticated;
grant select on public.tas_workflow_task       to authenticated;
grant select on public.tas_workflow_history    to authenticated;
grant select on public.tas_workflow_event      to authenticated;

-- =============================================================================
-- End of schema. RPC functions follow in the paired file
-- 20260617220001_m0_3_workflow_rpc.sql
-- =============================================================================
