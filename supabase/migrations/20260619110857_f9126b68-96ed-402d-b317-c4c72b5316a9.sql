-- M1.2 Job Requisition Management: tables, RLS, grants, triggers, seed, and RPCs.
-- Combined from supabase/migrations/20260619100000_m1_2_requisition.sql
-- and supabase/migrations/20260619100001_m1_2_requisition_rpc.sql (exact contents).

create extension if not exists "pgcrypto";

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

drop trigger if exists trg_tas_budgeted_position_updated_at on public.tas_budgeted_position;
create trigger trg_tas_budgeted_position_updated_at before update on public.tas_budgeted_position
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_requisition_updated_at on public.tas_requisition;
create trigger trg_tas_requisition_updated_at before update on public.tas_requisition
  for each row execute function public.tas_set_updated_at();

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

alter table public.tas_budgeted_position  enable row level security;
alter table public.tas_requisition        enable row level security;
alter table public.tas_requisition_event  enable row level security;
alter table public.tas_requisition_counter enable row level security;

drop policy if exists tas_budgeted_position_select_auth on public.tas_budgeted_position;
create policy tas_budgeted_position_select_auth on public.tas_budgeted_position
  for select to authenticated using (true);

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

drop policy if exists tas_requisition_event_select_auth on public.tas_requisition_event;
create policy tas_requisition_event_select_auth on public.tas_requisition_event
  for select to authenticated using (true);

grant select on public.tas_budgeted_position to authenticated;
grant select, insert on public.tas_requisition to authenticated;
grant select on public.tas_requisition_event  to authenticated;

-- Seed: workflow definition + steps
insert into public.tas_workflow_definition (request_type, version, name_en, name_ar, status)
values ('requisition', 1, 'Job Requisition Approval', 'اعتماد طلب التوظيف', 'active')
on conflict (request_type, version) do nothing;

insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 1, 'Manager Review', 'مراجعة المدير', 'role', '{"role_code":"APPROVER"}'::jsonb, 1, 'return'
from public.tas_workflow_definition d
where d.request_type = 'requisition' and d.version = 1
on conflict (definition_id, step_no) do nothing;

insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, quorum, on_reject)
select d.id, 2, 'HR Approval', 'اعتماد الموارد البشرية', 'role', '{"role_code":"HR_MANAGER"}'::jsonb, 1, 'stop'
from public.tas_workflow_definition d
where d.request_type = 'requisition' and d.version = 1
on conflict (definition_id, step_no) do nothing;

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

-- ============================ RPCs ============================

create or replace function public.check_budgeted_position(
  p_job_position_id uuid,
  p_department_id   uuid,
  p_headcount       int
)
returns table(budgeted int, filled int, available int, over_budget boolean)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select budgeted_count, filled_count
    from public.tas_budgeted_position
    where job_position_id = p_job_position_id
      and status = 'active'
      and (p_department_id is null or department_id is null or department_id = p_department_id)
    order by case
      when department_id = p_department_id then 0
      when department_id is null then 1
      else 2 end
    limit 1
  )
  select
    coalesce((select budgeted_count from b), 0),
    coalesce((select filled_count from b), 0),
    coalesce((select budgeted_count from b), 0) - coalesce((select filled_count from b), 0),
    (
      (select budgeted_count from b) is not null
      and (select budgeted_count from b) > 0
      and (coalesce((select filled_count from b), 0) + coalesce(p_headcount, 0)) > (select budgeted_count from b)
    );
$$;

create or replace function public.submit_requisition(p_requisition_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req      public.tas_requisition;
  v_instance uuid;
  v_snapshot jsonb := '{}'::jsonb;
  v_title    text;
begin
  select * into v_req from public.tas_requisition where id = p_requisition_id;
  if v_req.id is null then
    raise exception 'requisition % not found', p_requisition_id;
  end if;
  if v_req.status <> 'draft' then
    raise exception 'only draft requisitions can be submitted (current: %)', v_req.status;
  end if;

  if v_req.job_position_id is null or v_req.entity_id is null or coalesce(v_req.headcount, 0) < 1
     or (coalesce(v_req.title_en, '') = '' and coalesce(v_req.title_ar, '') = '') then
    raise exception 'requisition is missing required fields (title, position, entity, headcount)';
  end if;

  if not exists (
    select 1 from public.tas_workflow_definition
    where request_type = 'requisition' and status = 'active'
  ) then
    insert into public.tas_requisition_event
      (requisition_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_requisition_id, 'submit_blocked', v_req.status, v_req.status, v_req.requested_by,
            jsonb_build_object('reason', 'no active requisition workflow definition'));
    raise exception 'no active requisition workflow definition';
  end if;

  if v_req.jd_template_id is not null then
    v_snapshot := jsonb_build_object(
      'template', (select to_jsonb(t) from public.tas_jd_template t where t.id = v_req.jd_template_id),
      'sections', coalesce((
        select jsonb_agg(to_jsonb(s) order by s.sort_order)
        from public.tas_jd_section s where s.jd_template_id = v_req.jd_template_id
      ), '[]'::jsonb),
      'competencies', coalesce((
        select jsonb_agg(jsonb_build_object('competency', to_jsonb(c), 'proficiency_level', jc.proficiency_level))
        from public.tas_jd_competency jc
        join public.tas_competency c on c.id = jc.competency_id
        where jc.jd_template_id = v_req.jd_template_id
      ), '[]'::jsonb)
    );
  else
    v_snapshot := coalesce(v_req.jd_snapshot_json, '{}'::jsonb);
  end if;

  v_title := coalesce(v_req.title_en, v_req.title_ar, v_req.reference);

  v_instance := public.submit_workflow(
    'requisition', p_requisition_id::text, v_req.requested_by,
    v_req.entity_id, v_req.branch_id, v_req.department_id,
    jsonb_build_object('headcount', v_req.headcount, 'salary_amount', v_req.salary_max, 'position_id', v_req.job_position_id)
  );

  update public.tas_requisition
    set jd_snapshot_json = v_snapshot,
        status = 'in_approval',
        workflow_instance_id = v_instance,
        updated_by = v_req.requested_by
    where id = p_requisition_id;

  insert into public.tas_requisition_event
    (requisition_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_requisition_id, 'submitted', v_req.status, 'in_approval', v_req.requested_by,
          jsonb_build_object('workflow_instance_id', v_instance));

  perform public.audit_log(v_req.requested_by, 'M1.2', 'requisition.submitted', 'requisition',
    p_requisition_id::text, jsonb_build_object('reference', v_req.reference, 'workflow_instance_id', v_instance));

  if v_req.requested_by is not null then
    perform public.notify('requisition.submitted', array[v_req.requested_by],
      jsonb_build_object('reference', v_req.reference, 'title', v_title, 'status', 'in_approval'),
      '/app/requisitions/' || p_requisition_id::text);
  end if;

  return v_instance;
end;
$$;

create or replace function public.sync_requisition_status(p_requisition_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req         public.tas_requisition;
  v_inst_status text;
  v_new         text;
  v_title       text;
begin
  select * into v_req from public.tas_requisition where id = p_requisition_id;
  if v_req.id is null then
    return null;
  end if;
  if v_req.workflow_instance_id is null then
    return v_req.status;
  end if;

  select status into v_inst_status from public.tas_workflow_instance where id = v_req.workflow_instance_id;

  v_new := case v_inst_status
    when 'approved' then 'approved'
    when 'rejected' then 'cancelled'
    when 'returned' then 'draft'
    else null
  end;

  if v_new is null or v_new = v_req.status then
    return v_req.status;
  end if;

  update public.tas_requisition set status = v_new where id = p_requisition_id;

  insert into public.tas_requisition_event
    (requisition_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_requisition_id, 'status_synced', v_req.status, v_new, null,
          jsonb_build_object('instance_status', v_inst_status));

  perform public.audit_log(v_req.requested_by, 'M1.2', 'requisition.' || v_new, 'requisition',
    p_requisition_id::text, jsonb_build_object('from', v_req.status, 'to', v_new));

  v_title := coalesce(v_req.title_en, v_req.title_ar, v_req.reference);
  if v_req.requested_by is not null then
    perform public.notify(
      case v_new
        when 'approved'  then 'requisition.approved'
        when 'cancelled' then 'requisition.rejected'
        when 'draft'     then 'requisition.changes_requested'
      end,
      array[v_req.requested_by],
      jsonb_build_object('reference', v_req.reference, 'title', v_title, 'status', v_new),
      '/app/requisitions/' || p_requisition_id::text);
  end if;

  return v_new;
end;
$$;

create or replace function public.transition_requisition(p_requisition_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req    public.tas_requisition;
  v_new    text;
  v_caller uuid;
begin
  select * into v_req from public.tas_requisition where id = p_requisition_id;
  if v_req.id is null then
    raise exception 'requisition % not found', p_requisition_id;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  v_new := case p_action
    when 'publish' then case when v_req.status = 'approved' then 'published' end
    when 'hold'    then case when v_req.status in ('approved','published','in_approval') then 'on_hold' end
    when 'cancel'  then case when v_req.status in ('draft','submitted','in_approval','approved','published','on_hold') then 'cancelled' end
    when 'close'   then case when v_req.status in ('published','on_hold') then 'closed' end
    else null
  end;

  if v_new is null then
    raise exception 'invalid transition % from status %', p_action, v_req.status;
  end if;

  update public.tas_requisition set status = v_new, updated_by = v_caller where id = p_requisition_id;

  insert into public.tas_requisition_event
    (requisition_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_requisition_id, 'transition.' || p_action, v_req.status, v_new, v_caller, '{}'::jsonb);

  perform public.audit_log(v_caller, 'M1.2', 'requisition.' || p_action, 'requisition',
    p_requisition_id::text, jsonb_build_object('from', v_req.status, 'to', v_new));
end;
$$;

create or replace function public.list_requisitions(
  p_status        text default null,
  p_department_id uuid default null,
  p_position_id   uuid default null,
  p_from          date default null,
  p_to            date default null,
  p_mine          boolean default false,
  p_limit         int default 50,
  p_offset        int default 0
)
returns table(
  id                   uuid,
  reference            text,
  title_en             text,
  title_ar             text,
  job_position_id      uuid,
  department_id        uuid,
  headcount            int,
  status               text,
  workflow_instance_id uuid,
  requested_by         uuid,
  created_at           timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.reference, r.title_en, r.title_ar, r.job_position_id, r.department_id,
         r.headcount, r.status, r.workflow_instance_id, r.requested_by, r.created_at
  from public.tas_requisition r
  where (p_status is null or r.status = p_status)
    and (p_department_id is null or r.department_id = p_department_id)
    and (p_position_id is null or r.job_position_id = p_position_id)
    and (p_from is null or r.created_at >= p_from)
    and (p_to is null or r.created_at < (p_to + 1))
    and (
      not coalesce(p_mine, false)
      or r.requested_by in (
        select u.id from public.tas_user u
        where u.entra_object_id = (auth.jwt() ->> 'oid')
           or u.email = nullif(auth.jwt() ->> 'email','')::citext
      )
    )
  order by r.created_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.requisition_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'requisition', (select to_jsonb(r) from public.tas_requisition r where r.id = p_id),
    'jd_snapshot', (select r.jd_snapshot_json from public.tas_requisition r where r.id = p_id),
    'instance', (
      select case when r.workflow_instance_id is not null
                  then public.instance_timeline(r.workflow_instance_id)
                  else null end
      from public.tas_requisition r where r.id = p_id
    ),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from public.tas_requisition_event e where e.requisition_id = p_id
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.check_budgeted_position(uuid, uuid, int)        to authenticated;
grant execute on function public.sync_requisition_status(uuid)                   to authenticated;
grant execute on function public.list_requisitions(text, uuid, uuid, date, date, boolean, int, int) to authenticated;
grant execute on function public.requisition_detail(uuid)                        to authenticated;

revoke execute on function public.submit_requisition(uuid)                       from public;
revoke execute on function public.transition_requisition(uuid, text)             from public;
revoke execute on function public.generate_requisition_ref()                     from public;
