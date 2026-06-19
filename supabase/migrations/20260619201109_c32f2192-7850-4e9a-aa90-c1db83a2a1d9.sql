-- M1.9 Offers: tables, RPCs, workflow seed
-- File 1: 20260619200000_m1_9_offers.sql
-- =============================================================================
-- Al Hamra TAS — Module M1.9: Offer Management (ATS MVP capstone)
-- =============================================================================

create extension if not exists "pgcrypto";

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

drop trigger if exists trg_tas_offer_updated_at on public.tas_offer;
create trigger trg_tas_offer_updated_at before update on public.tas_offer
  for each row execute function public.tas_set_updated_at();

alter table public.tas_offer         enable row level security;
alter table public.tas_offer_event   enable row level security;
alter table public.tas_offer_counter enable row level security;

drop policy if exists tas_offer_select_auth on public.tas_offer;
create policy tas_offer_select_auth on public.tas_offer
  for select to authenticated using (true);

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

drop policy if exists tas_offer_event_select_auth on public.tas_offer_event;
create policy tas_offer_event_select_auth on public.tas_offer_event
  for select to authenticated using (true);

grant select, insert on public.tas_offer to authenticated;
grant select on public.tas_offer_event    to authenticated;

insert into public.tas_workflow_definition (request_type, version, name_en, name_ar, status)
values ('offer', 1, 'Job Offer Approval', 'اعتماد عرض العمل', 'active')
on conflict (request_type, version) do nothing;

insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 1, 'Hiring Manager Review', 'مراجعة مدير التوظيف', 'role', '{"role_code":"HIRING_MANAGER"}'::jsonb, 1, 'return'
from public.tas_workflow_definition d
where d.request_type = 'offer' and d.version = 1
on conflict (definition_id, step_no) do nothing;

insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 2, 'HR Approval', 'اعتماد الموارد البشرية', 'role', '{"role_code":"HR_MANAGER"}'::jsonb, 1, 'stop'
from public.tas_workflow_definition d
where d.request_type = 'offer' and d.version = 1
on conflict (definition_id, step_no) do nothing;