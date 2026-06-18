create extension if not exists "pgcrypto";

alter table public.tas_access_audit
  drop constraint if exists tas_access_audit_event_type_check;
alter table public.tas_access_audit
  add constraint tas_access_audit_event_type_check
  check (event_type in ('signin','signout','role_change','scope_change',
                        'delegation','denied','deactivate','provision','workflow'));

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

create unique index if not exists uq_tas_workflow_active_per_type
  on public.tas_workflow_definition (request_type)
  where status = 'active';

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

alter table public.tas_workflow_definition enable row level security;
alter table public.tas_workflow_step       enable row level security;
alter table public.tas_workflow_instance   enable row level security;
alter table public.tas_workflow_task       enable row level security;
alter table public.tas_workflow_history    enable row level security;
alter table public.tas_workflow_event      enable row level security;

drop policy if exists tas_wf_definition_select_auth on public.tas_workflow_definition;
create policy tas_wf_definition_select_auth on public.tas_workflow_definition
  for select to authenticated using (true);

drop policy if exists tas_wf_step_select_auth on public.tas_workflow_step;
create policy tas_wf_step_select_auth on public.tas_workflow_step
  for select to authenticated using (true);

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

grant select on public.tas_workflow_definition to authenticated;
grant select on public.tas_workflow_step       to authenticated;
grant select on public.tas_workflow_instance   to authenticated;
grant select on public.tas_workflow_task       to authenticated;
grant select on public.tas_workflow_history    to authenticated;
grant select on public.tas_workflow_event      to authenticated;

create or replace function public.eval_condition(p_condition jsonb, p_context jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_field  text;
  v_op     text;
  v_value  jsonb;
  v_actual jsonb;
  v_a numeric;
  v_b numeric;
begin
  if p_condition is null or jsonb_typeof(p_condition) = 'null' then
    return true;
  end if;

  v_field := p_condition ->> 'field';
  v_op    := p_condition ->> 'op';
  v_value := p_condition -> 'value';
  if v_field is null or v_op is null then
    return true;
  end if;

  v_actual := coalesce(p_context, '{}'::jsonb) -> v_field;

  if v_op = '=' then
    return v_actual is not distinct from v_value;
  elsif v_op = '!=' then
    return v_actual is distinct from v_value;
  elsif v_op = 'in' then
    if v_value is null or jsonb_typeof(v_value) <> 'array' then
      return false;
    end if;
    return exists (
      select 1 from jsonb_array_elements(v_value) e where e = v_actual
    );
  elsif v_op in ('>','>=','<','<=') then
    begin
      v_a := (v_actual #>> '{}')::numeric;
      v_b := (v_value  #>> '{}')::numeric;
    exception when others then
      return false;
    end;
    if    v_op = '>'  then return v_a >  v_b;
    elsif v_op = '>=' then return v_a >= v_b;
    elsif v_op = '<'  then return v_a <  v_b;
    else                   return v_a <= v_b;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public._wf_apply_delegation(p_user uuid, p_request_type text)
returns table(final_uid uuid, via text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid := p_user;
  v_via     text := 'direct';
  v_visited uuid[] := array[p_user];
  v_next    uuid;
  v_hops    int := 0;
begin
  loop
    select d.delegate_user_id
      into v_next
    from public.tas_delegation d
    where d.delegator_user_id = v_current
      and d.status = 'active'
      and (d.start_date is null or d.start_date <= current_date)
      and (d.end_date   is null or d.end_date   >= current_date)
      and (
        d.type = 'role_wide'
        or (
          d.type = 'task_specific'
          and jsonb_typeof(d.scope_json) = 'array'
          and (
            d.scope_json = '[]'::jsonb
            or exists (select 1 from jsonb_array_elements_text(d.scope_json) x where x = p_request_type)
            or d.scope_json @> jsonb_build_array(jsonb_build_object('request_type', p_request_type))
          )
        )
      )
    order by d.start_date desc nulls last
    limit 1;

    exit when v_next is null;
    exit when v_next = any(v_visited);
    exit when v_hops >= 10;

    v_current := v_next;
    v_via     := 'delegation';
    v_visited := array_append(v_visited, v_next);
    v_hops    := v_hops + 1;
  end loop;

  final_uid := v_current;
  via       := v_via;
  return next;
end;
$$;

create or replace function public.resolve_step_approvers(p_instance_id uuid, p_step_no int)
returns table(user_id uuid, resolved_via text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def     uuid;
  v_entity  uuid;
  v_branch  uuid;
  v_dept    uuid;
  v_rtype   text;
  v_rule    jsonb;
  v_rule_kind text;
  v_base    uuid[];
  v_rel     text;
begin
  select definition_id, entity_id, branch_id, department_id, request_type
    into v_def, v_entity, v_branch, v_dept, v_rtype
  from public.tas_workflow_instance
  where id = p_instance_id;

  select approver_rule_type, approver_rule_value
    into v_rule_kind, v_rule
  from public.tas_workflow_step
  where definition_id = v_def and step_no = p_step_no;

  if v_rule_kind is null then
    return;
  end if;

  if v_rule_kind = 'named_user' then
    v_base := array[(v_rule ->> 'user_id')::uuid];

  elsif v_rule_kind = 'role' then
    select array_agg(distinct ur.user_id)
      into v_base
    from public.tas_user_role ur
    join public.tas_role r on r.id = ur.role_id
    join public.tas_user u on u.id = ur.user_id and u.status = 'active'
    where r.code = (v_rule ->> 'role_code')
      and exists (
        select 1 from public.tas_user_scope s
        where s.user_id = ur.user_id
          and (v_entity is null or s.entity_id = v_entity)
          and (s.branch_id     is null or v_branch is null or s.branch_id = v_branch)
          and (s.department_id is null or v_dept   is null or s.department_id = v_dept)
      );

  elsif v_rule_kind = 'hierarchy' then
    v_rel := v_rule ->> 'relative';
    if v_rel = 'department_head' and v_dept is not null then
      select array_agg(distinct s.user_id) into v_base
      from public.tas_user_scope s
      join public.tas_user u on u.id = s.user_id and u.status = 'active'
      where s.department_id = v_dept;
    elsif v_rel = 'branch_manager' and v_branch is not null then
      select array_agg(distinct s.user_id) into v_base
      from public.tas_user_scope s
      join public.tas_user u on u.id = s.user_id and u.status = 'active'
      where s.branch_id = v_branch and s.department_id is null;
    elsif v_entity is not null then
      select array_agg(distinct s.user_id) into v_base
      from public.tas_user_scope s
      join public.tas_user u on u.id = s.user_id and u.status = 'active'
      where s.entity_id = v_entity and s.branch_id is null;
    end if;
  end if;

  if v_base is null then
    return;
  end if;

  return query
  with base as (
    select distinct b as uid from unnest(v_base) b where b is not null
  )
  select d.final_uid, d.via
  from base
  cross join lateral public._wf_apply_delegation(base.uid, v_rtype) d;
end;
$$;

create or replace function public._wf_audit(p_instance uuid, p_actor uuid, p_action text, p_step int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tas_access_audit (user_id, event_type, detail_json)
  values (p_actor, 'workflow',
          jsonb_build_object('instance_id', p_instance, 'action', p_action, 'step_no', p_step));
end;
$$;

create or replace function public._wf_enter_step(p_instance uuid, p_step_no int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def     uuid;
  v_sla     int;
  v_count   int := 0;
  v_appr    record;
begin
  select definition_id into v_def from public.tas_workflow_instance where id = p_instance;
  select sla_hours into v_sla from public.tas_workflow_step where definition_id = v_def and step_no = p_step_no;

  update public.tas_workflow_instance set current_step = p_step_no where id = p_instance;

  for v_appr in select * from public.resolve_step_approvers(p_instance, p_step_no) loop
    insert into public.tas_workflow_task
      (instance_id, step_no, assignee_user_id, resolved_via, status, due_at)
    values
      (p_instance, p_step_no, v_appr.user_id, v_appr.resolved_via, 'pending',
       case when v_sla is not null then now() + make_interval(hours => v_sla) else null end);
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    insert into public.tas_workflow_event (instance_id, event_type, payload_json)
    values (p_instance, 'task_created', jsonb_build_object('step_no', p_step_no, 'count', v_count));
  end if;

  return v_count;
end;
$$;

create or replace function public._wf_advance(p_instance uuid, p_from_step int, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst   public.tas_workflow_instance;
  v_step   public.tas_workflow_step;
  v_count  int;
begin
  select * into v_inst from public.tas_workflow_instance where id = p_instance;

  for v_step in
    select * from public.tas_workflow_step
    where definition_id = v_inst.definition_id and step_no > p_from_step
    order by step_no
  loop
    if public.eval_condition(v_step.condition_json, v_inst.context_json) then
      v_count := public._wf_enter_step(p_instance, v_step.step_no);
      if v_count = 0 then
        update public.tas_workflow_instance set status = 'blocked' where id = p_instance;
        insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
        values (p_instance, v_step.step_no, p_actor, 'blocked', 'in_progress', 'blocked', 'no approver resolved');
        insert into public.tas_workflow_event (instance_id, event_type, payload_json)
        values (p_instance, 'blocked', jsonb_build_object('step_no', v_step.step_no));
        perform public._wf_audit(p_instance, p_actor, 'blocked', v_step.step_no);
      else
        insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
        values (p_instance, v_step.step_no, p_actor, 'step_advanced', 'in_progress', 'in_progress', null);
        insert into public.tas_workflow_event (instance_id, event_type, payload_json)
        values (p_instance, 'step_advanced', jsonb_build_object('step_no', v_step.step_no));
        perform public._wf_audit(p_instance, p_actor, 'step_advanced', v_step.step_no);
      end if;
      return;
    else
      insert into public.tas_workflow_history (instance_id, step_no, action, from_status, to_status, comment)
      values (p_instance, v_step.step_no, 'skipped', null, 'skipped', 'condition not met');
    end if;
  end loop;

  update public.tas_workflow_instance set status = 'approved' where id = p_instance;
  insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
  values (p_instance, p_from_step, p_actor, 'completed', 'in_progress', 'approved', null);
  insert into public.tas_workflow_event (instance_id, event_type, payload_json)
  values (p_instance, 'instance_completed', '{}'::jsonb);
  perform public._wf_audit(p_instance, p_actor, 'instance_completed', p_from_step);
end;
$$;

create or replace function public.activate_workflow(p_definition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  select request_type into v_type from public.tas_workflow_definition where id = p_definition_id;
  if v_type is null then
    raise exception 'workflow definition % not found', p_definition_id;
  end if;

  update public.tas_workflow_definition
    set status = 'archived'
    where request_type = v_type and status = 'active' and id <> p_definition_id;

  update public.tas_workflow_definition
    set status = 'active'
    where id = p_definition_id;
end;
$$;

create or replace function public.submit_workflow(
  p_request_type   text,
  p_request_ref    text,
  p_requester_id   uuid,
  p_entity_id      uuid,
  p_branch_id      uuid,
  p_department_id  uuid,
  p_context_json   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def      uuid;
  v_instance uuid;
  v_step     public.tas_workflow_step;
  v_count    int;
  v_ctx      jsonb := coalesce(p_context_json, '{}'::jsonb);
begin
  select id into v_def
  from public.tas_workflow_definition
  where request_type = p_request_type and status = 'active'
  order by version desc
  limit 1;

  if v_def is null then
    raise exception 'no active workflow definition for request_type %', p_request_type;
  end if;

  insert into public.tas_workflow_instance
    (definition_id, request_type, request_ref, requester_user_id,
     entity_id, branch_id, department_id, status, current_step, context_json, created_by)
  values
    (v_def, p_request_type, p_request_ref, p_requester_id,
     p_entity_id, p_branch_id, p_department_id, 'in_progress', 1, v_ctx, p_requester_id)
  returning id into v_instance;

  insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
  values (v_instance, 0, p_requester_id, 'submitted', null, 'in_progress', p_request_ref);

  for v_step in
    select * from public.tas_workflow_step where definition_id = v_def order by step_no
  loop
    if public.eval_condition(v_step.condition_json, v_ctx) then
      v_count := public._wf_enter_step(v_instance, v_step.step_no);
      if v_count = 0 then
        update public.tas_workflow_instance set status = 'blocked' where id = v_instance;
        insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
        values (v_instance, v_step.step_no, p_requester_id, 'blocked', 'in_progress', 'blocked', 'no approver resolved');
        insert into public.tas_workflow_event (instance_id, event_type, payload_json)
        values (v_instance, 'blocked', jsonb_build_object('step_no', v_step.step_no));
        perform public._wf_audit(v_instance, p_requester_id, 'blocked', v_step.step_no);
      else
        perform public._wf_audit(v_instance, p_requester_id, 'submitted', v_step.step_no);
      end if;
      return v_instance;
    else
      insert into public.tas_workflow_history (instance_id, step_no, action, from_status, to_status, comment)
      values (v_instance, v_step.step_no, 'skipped', null, 'skipped', 'condition not met');
    end if;
  end loop;

  update public.tas_workflow_instance set status = 'approved' where id = v_instance;
  insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
  values (v_instance, 0, p_requester_id, 'completed', 'in_progress', 'approved', 'no applicable steps');
  insert into public.tas_workflow_event (instance_id, event_type, payload_json)
  values (v_instance, 'instance_completed', '{}'::jsonb);
  perform public._wf_audit(v_instance, p_requester_id, 'instance_completed', 0);

  return v_instance;
end;
$$;

create or replace function public.act_on_task(
  p_task_id    uuid,
  p_action     text,
  p_comment    text default null,
  p_comment_ar text default null,
  p_target     uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task     public.tas_workflow_task;
  v_inst     public.tas_workflow_instance;
  v_step     public.tas_workflow_step;
  v_caller   uuid;
  v_actor    uuid;
  v_approved int;
begin
  select * into v_task from public.tas_workflow_task where id = p_task_id;
  if v_task is null then
    raise exception 'task % not found', p_task_id;
  end if;
  if v_task.status <> 'pending' then
    raise exception 'task % is not pending', p_task_id;
  end if;

  select * into v_inst from public.tas_workflow_instance where id = v_task.instance_id;
  select * into v_step from public.tas_workflow_step
    where definition_id = v_inst.definition_id and step_no = v_task.step_no;

  select u.id into v_caller
  from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if v_caller is not null and v_caller <> v_task.assignee_user_id then
    raise exception 'caller is not the assignee of task %', p_task_id;
  end if;
  v_actor := coalesce(v_caller, v_task.assignee_user_id);

  if p_action = 'approve' then
    update public.tas_workflow_task
      set status = 'approved', decision_comment_en = p_comment,
          decision_comment_ar = p_comment_ar, acted_at = now()
      where id = p_task_id;
    insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
    values (v_inst.id, v_task.step_no, v_actor, 'approve', 'pending', 'approved', p_comment);
    perform public._wf_audit(v_inst.id, v_actor, 'approve', v_task.step_no);

    select count(*) into v_approved
    from public.tas_workflow_task
    where instance_id = v_inst.id and step_no = v_task.step_no and status = 'approved';

    if v_approved >= coalesce(v_step.quorum, 1) then
      update public.tas_workflow_task
        set status = 'skipped'
        where instance_id = v_inst.id and step_no = v_task.step_no and status = 'pending';
      perform public._wf_advance(v_inst.id, v_task.step_no, v_actor);
    end if;

  elsif p_action = 'reject' then
    update public.tas_workflow_task
      set status = 'rejected', decision_comment_en = p_comment,
          decision_comment_ar = p_comment_ar, acted_at = now()
      where id = p_task_id;
    insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
    values (v_inst.id, v_task.step_no, v_actor, 'reject', 'pending', 'rejected', p_comment);

    update public.tas_workflow_task
      set status = 'skipped'
      where instance_id = v_inst.id and step_no = v_task.step_no and status = 'pending';

    if v_step.on_reject = 'return' then
      update public.tas_workflow_instance set status = 'returned' where id = v_inst.id;
      insert into public.tas_workflow_event (instance_id, event_type, payload_json)
      values (v_inst.id, 'returned', jsonb_build_object('step_no', v_task.step_no));
      perform public._wf_audit(v_inst.id, v_actor, 'returned', v_task.step_no);
    else
      update public.tas_workflow_instance set status = 'rejected' where id = v_inst.id;
      insert into public.tas_workflow_event (instance_id, event_type, payload_json)
      values (v_inst.id, 'rejected', jsonb_build_object('step_no', v_task.step_no));
      perform public._wf_audit(v_inst.id, v_actor, 'rejected', v_task.step_no);
    end if;

  elsif p_action = 'request_changes' then
    update public.tas_workflow_task
      set status = 'changes_requested', decision_comment_en = p_comment,
          decision_comment_ar = p_comment_ar, acted_at = now()
      where id = p_task_id;
    update public.tas_workflow_instance set status = 'returned' where id = v_inst.id;
    insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
    values (v_inst.id, v_task.step_no, v_actor, 'request_changes', 'pending', 'returned', p_comment);
    insert into public.tas_workflow_event (instance_id, event_type, payload_json)
    values (v_inst.id, 'returned', jsonb_build_object('step_no', v_task.step_no));
    perform public._wf_audit(v_inst.id, v_actor, 'request_changes', v_task.step_no);

  elsif p_action = 'reassign' then
    if p_target is null then
      raise exception 'reassign requires a target user';
    end if;
    update public.tas_workflow_task
      set status = 'reassigned', acted_at = now(), decision_comment_en = p_comment
      where id = p_task_id;
    insert into public.tas_workflow_task
      (instance_id, step_no, assignee_user_id, resolved_via, status, due_at)
    values
      (v_inst.id, v_task.step_no, p_target, 'reassign', 'pending', v_task.due_at);
    insert into public.tas_workflow_history (instance_id, step_no, actor_user_id, action, from_status, to_status, comment)
    values (v_inst.id, v_task.step_no, v_actor, 'reassign', 'pending', 'reassigned', p_comment);
    perform public._wf_audit(v_inst.id, v_actor, 'reassign', v_task.step_no);

  else
    raise exception 'unknown action %', p_action;
  end if;
end;
$$;

create or replace function public.my_pending_tasks(p_user_id uuid)
returns table(
  task_id      uuid,
  instance_id  uuid,
  step_no      int,
  request_type text,
  request_ref  text,
  instance_status text,
  resolved_via text,
  due_at       timestamptz,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.instance_id, t.step_no, i.request_type, i.request_ref,
         i.status, t.resolved_via, t.due_at, t.created_at
  from public.tas_workflow_task t
  join public.tas_workflow_instance i on i.id = t.instance_id
  where t.assignee_user_id = p_user_id
    and t.status = 'pending'
  order by t.due_at nulls last, t.created_at;
$$;

create or replace function public.instance_timeline(p_instance_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'instance', (
      select to_jsonb(i) from public.tas_workflow_instance i where i.id = p_instance_id
    ),
    'steps', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.step_no)
      from public.tas_workflow_step s
      join public.tas_workflow_instance i on i.definition_id = s.definition_id
      where i.id = p_instance_id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.step_no, t.created_at)
      from public.tas_workflow_task t
      where t.instance_id = p_instance_id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at)
      from public.tas_workflow_history h
      where h.instance_id = p_instance_id
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.act_on_task(uuid, text, text, text, uuid)   to authenticated;
grant execute on function public.my_pending_tasks(uuid)                      to authenticated;
grant execute on function public.instance_timeline(uuid)                     to authenticated;

revoke execute on function public.activate_workflow(uuid)                    from public;
revoke execute on function public.submit_workflow(text, text, uuid, uuid, uuid, uuid, jsonb) from public;
revoke execute on function public.resolve_step_approvers(uuid, int)          from public;
revoke execute on function public._wf_apply_delegation(uuid, text)           from public;
revoke execute on function public._wf_enter_step(uuid, int)                  from public;
revoke execute on function public._wf_advance(uuid, int, uuid)               from public;
revoke execute on function public._wf_audit(uuid, uuid, text, int)           from public;