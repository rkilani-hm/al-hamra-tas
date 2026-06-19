-- =============================================================================
-- Al Hamra TAS — Module M1.2: Requisition RPC functions
-- =============================================================================
-- Paired with 20260619100000_m1_2_requisition.sql. SECURITY DEFINER + search_path.
-- Read/derive RPCs granted to authenticated; the write RPCs submit_requisition /
-- transition_requisition stay service-role-guarded (revoked from public) until M3.1.
-- They integrate M0.3 submit_workflow, M0.4 notify, and M0.5 audit_log.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- check_budgeted_position(position, department, headcount)
--   -> (budgeted, filled, available, over_budget). Always returns one row.
--   over_budget is warn-only: false when no active budget line exists.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- submit_requisition(id): freeze JD snapshot, call submit_workflow, store the
-- instance id, audit + notify. Atomic (either fully submitted or rolled back to
-- draft — never silently lost). Service-role-guarded.
-- -----------------------------------------------------------------------------
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

  -- Required-field validation.
  if v_req.job_position_id is null or v_req.entity_id is null or coalesce(v_req.headcount, 0) < 1
     or (coalesce(v_req.title_en, '') = '' and coalesce(v_req.title_ar, '') = '') then
    raise exception 'requisition is missing required fields (title, position, entity, headcount)';
  end if;

  -- Must have an active 'requisition' workflow definition (we seed one). Surface
  -- the error and leave the requisition as draft rather than losing it.
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

  -- Freeze the bilingual JD snapshot from the linked template (if any).
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
    -- Manual JD: keep whatever snapshot the client already captured.
    v_snapshot := coalesce(v_req.jd_snapshot_json, '{}'::jsonb);
  end if;

  v_title := coalesce(v_req.title_en, v_req.title_ar, v_req.reference);

  -- Hand off to the M0.3 engine (runs as definer; submit_workflow is service-role).
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

-- -----------------------------------------------------------------------------
-- sync_requisition_status(id): derive requisition status from the linked workflow
-- instance; persist ONLY on a terminal change (+ event, audit, requester notify).
-- Returns the (possibly updated) requisition status. Authenticated (safe).
-- -----------------------------------------------------------------------------
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
    else null            -- in_progress / blocked -> leave as-is (stay in_approval)
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

-- -----------------------------------------------------------------------------
-- transition_requisition(id, action): publish | hold | cancel | close, with
-- guarded valid transitions (+ event, audit). Service-role-guarded.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- list_requisitions(...) -> org-scoped paged summary; null filters ignored.
-- p_mine restricts to the caller's own requisitions (resolved via Entra JWT).
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- requisition_detail(id) -> jsonb { requisition, jd_snapshot, instance, events }.
-- instance reuses the M0.3 instance_timeline shape.
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- EXECUTE grants
-- =============================================================================
grant execute on function public.check_budgeted_position(uuid, uuid, int)        to authenticated;
grant execute on function public.sync_requisition_status(uuid)                   to authenticated;
grant execute on function public.list_requisitions(text, uuid, uuid, date, date, boolean, int, int) to authenticated;
grant execute on function public.requisition_detail(uuid)                        to authenticated;

-- Write RPCs stay service-role-guarded until M3.1 (revoke from public). They are
-- callable by the service-role context / definer-chained calls only.
revoke execute on function public.submit_requisition(uuid)                       from public;
revoke execute on function public.transition_requisition(uuid, text)             from public;
revoke execute on function public.generate_requisition_ref()                     from public;

-- =============================================================================
-- End of M1.2 RPC functions.
-- =============================================================================
