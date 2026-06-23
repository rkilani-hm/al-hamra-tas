-- =============================================================================
-- Al Hamra TAS — M3.1-step2b-wave2: Enforcement flip for Recruiter Core
-- =============================================================================
-- SECOND enforcement wave. Flips the recruiter-core write RPCs (requisition,
-- application, candidate, screening) to the data-driven _has_permission() gate.
-- Unlike wave 1 (uniform), these RPCs had DIFFERENT current guards, so the change
-- differs per RPC (verified against the live source migrations):
--
--   Cat A — SERVICE-ROLE-GUARDED today (revoke execute from public; M1.2):
--     submit_requisition, transition_requisition
--     -> add the gate AND add `grant execute … to authenticated` (LOOSENING:
--        opening to permitted roles). Without the grant they stay uncallable.
--
--   Cat B — AUTHENTICATED, NO permission check today (M1.5 realign / M1.6):
--     upsert_candidate, create_application, move_application_stage,
--     set_application_status, create_screening, save_screening_scores,
--     submit_screening
--     -> add the gate only (TIGHTENING). EXECUTE-to-authenticated already exists.
--
-- GATE/GRANT CHANGE ONLY. Each function is reproduced VERBATIM from its live
-- source — identical signature, SECURITY DEFINER, search_path, declarations, body
-- — with the single gate line inserted AFTER caller resolution, BEFORE the
-- operation. CREATE OR REPLACE (idempotent). No storage bucket SQL. ON CONFLICT
-- reproduced unchanged (save_screening_scores' plain unique [rubric 12]). No
-- recursive CTEs. Signatures unchanged.
--
-- Keys: submit_requisition->requisition.submit; transition_requisition,
-- upsert_candidate(candidate.write), create_application/move/set(application.write),
-- create_screening/save_scores/submit_screening(screening.write). SYSTEM_ADMIN
-- bypasses all (built into _has_permission).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Requisition (Cat A — M1.2: submit_requisition, transition_requisition)
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

  if not public._has_permission('requisition.submit') then raise exception 'not_authorized'; end if;

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

  if not public._has_permission('requisition.write') then raise exception 'not_authorized'; end if;

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
-- Candidate + Application (Cat B — M1.5 realign current definitions)
-- -----------------------------------------------------------------------------
create or replace function public.upsert_candidate(
  p_id                uuid    default null,
  p_first_name        text    default null,
  p_last_name         text    default null,
  p_full_name_en      text    default null,
  p_full_name_ar      text    default null,
  p_email             text    default null,
  p_phone             text    default null,
  p_nationality       text    default null,
  p_nationality_class text    default null,
  p_current_title     text    default null,
  p_source            text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_id     uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('candidate.write') then raise exception 'not_authorized'; end if;

  if p_id is null then
    insert into public.tas_candidate
      (first_name, last_name, full_name_en, full_name_ar, email, phone,
       nationality, nationality_class, current_title, source, created_by)
    values
      (p_first_name, p_last_name, p_full_name_en, p_full_name_ar, nullif(p_email,'')::citext, p_phone,
       p_nationality, p_nationality_class, p_current_title, p_source, v_caller)
    returning id into v_id;
    perform public.audit_log(v_caller, 'M1.5', 'candidate.created', 'candidate', v_id::text,
      jsonb_build_object('name', coalesce(p_full_name_en, p_full_name_ar)));
  else
    update public.tas_candidate set
      first_name = p_first_name, last_name = p_last_name,
      full_name_en = p_full_name_en, full_name_ar = p_full_name_ar,
      email = nullif(p_email,'')::citext, phone = p_phone,
      nationality = p_nationality, nationality_class = p_nationality_class,
      current_title = p_current_title, source = p_source, updated_by = v_caller
    where id = p_id;
    v_id := p_id;
    perform public.audit_log(v_caller, 'M1.5', 'candidate.updated', 'candidate', p_id::text, '{}'::jsonb);
  end if;

  return v_id;
end;
$$;

create or replace function public.create_application(
  p_requisition_id uuid,
  p_candidate_id   uuid,
  p_source         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_stage  uuid;
  v_app    uuid;
begin
  if exists (
    select 1 from public.tas_application
    where requisition_id = p_requisition_id and candidate_id = p_candidate_id and status = 'active'
  ) then
    raise exception 'duplicate_active_application'
      using message = 'An active application already exists for this candidate and requisition.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('application.write') then raise exception 'not_authorized'; end if;

  select id into v_stage from public.tas_pipeline_stage
  where status = 'active' order by sort_order limit 1;

  insert into public.tas_application
    (requisition_id, candidate_id, current_stage_id, status, source, owner_user_id, created_by)
  values
    (p_requisition_id, p_candidate_id, v_stage, 'active', p_source, v_caller, v_caller)
  returning id into v_app;

  insert into public.tas_application_stage_history
    (application_id, from_stage_id, to_stage_id, moved_by, note)
  values (v_app, null, v_stage, v_caller, 'created');

  perform public.audit_log(v_caller, 'M1.5', 'application.created', 'application', v_app::text,
    jsonb_build_object('requisition_id', p_requisition_id, 'candidate_id', p_candidate_id));

  return v_app;
end;
$$;

create or replace function public.move_application_stage(
  p_application_id uuid,
  p_to_stage_id    uuid,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app    public.tas_application;
  v_to     public.tas_pipeline_stage;
  v_caller uuid;
begin
  select * into v_app from public.tas_application where id = p_application_id;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;

  select * into v_to from public.tas_pipeline_stage where id = p_to_stage_id;
  if v_to.id is null or v_to.status <> 'active' then
    raise exception 'target stage is invalid or inactive';
  end if;

  if v_app.current_stage_id is not distinct from p_to_stage_id then
    return; -- idempotent no-op
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('application.write') then raise exception 'not_authorized'; end if;

  insert into public.tas_application_stage_history
    (application_id, from_stage_id, to_stage_id, moved_by, note)
  values (p_application_id, v_app.current_stage_id, p_to_stage_id, v_caller, p_note);

  update public.tas_application set
    current_stage_id = p_to_stage_id,
    status = case
               when v_to.stage_type = 'hired'     then 'hired'
               when v_to.stage_type = 'rejected'  then 'rejected'
               when v_to.stage_type = 'withdrawn' then 'withdrawn'
               else v_app.status
             end,
    updated_by = v_caller
  where id = p_application_id;

  perform public.audit_log(v_caller, 'M1.5', 'application.stage_moved', 'application',
    p_application_id::text, jsonb_build_object('to_stage', v_to.code, 'stage_type', v_to.stage_type));
end;
$$;

create or replace function public.set_application_status(
  p_application_id uuid,
  p_status         text,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app    public.tas_application;
  v_caller uuid;
begin
  if p_status not in ('active','hired','rejected','withdrawn','on_hold') then
    raise exception 'invalid status %', p_status;
  end if;

  select * into v_app from public.tas_application where id = p_application_id;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('application.write') then raise exception 'not_authorized'; end if;

  update public.tas_application set
    status = p_status,
    rejection_reason = case when p_status = 'rejected' then p_reason else rejection_reason end,
    updated_by = v_caller
  where id = p_application_id;

  insert into public.tas_application_stage_history
    (application_id, from_stage_id, to_stage_id, moved_by, note)
  values (p_application_id, v_app.current_stage_id, v_app.current_stage_id, v_caller,
          coalesce(p_reason, 'status: ' || p_status));

  perform public.audit_log(v_caller, 'M1.5', 'application.status_' || p_status, 'application',
    p_application_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Screening (Cat B — M1.6: create_screening, save_screening_scores, submit_screening)
-- -----------------------------------------------------------------------------
create or replace function public.create_screening(
  p_application_id uuid,
  p_scorecard_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_card   uuid;
  v_id     uuid;
begin
  if not exists (select 1 from public.tas_application where id = p_application_id) then
    raise exception 'application % not found', p_application_id;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('screening.write') then raise exception 'not_authorized'; end if;

  -- Reuse the existing draft if present (keeps a single active draft per app).
  select id into v_id from public.tas_screening
  where application_id = p_application_id and status = 'draft'
  order by created_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- Resolve scorecard: explicit, else the active default, else any active.
  v_card := p_scorecard_id;
  if v_card is null then
    select id into v_card from public.tas_screening_scorecard
    where status = 'active' and code = 'DEFAULT_SCREENING' limit 1;
  end if;
  if v_card is null then
    select id into v_card from public.tas_screening_scorecard
    where status = 'active' order by code limit 1;
  end if;

  insert into public.tas_screening
    (application_id, scorecard_id, status, screened_by, created_by)
  values
    (p_application_id, v_card, 'draft', v_caller, v_caller)
  returning id into v_id;

  perform public.audit_log(v_caller, 'M1.6', 'screening.created', 'screening', v_id::text,
    jsonb_build_object('application_id', p_application_id, 'scorecard_id', v_card));

  return v_id;
end;
$$;

create or replace function public.save_screening_scores(
  p_screening_id uuid,
  p_scores       jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_overall numeric;
begin
  if not exists (select 1 from public.tas_screening where id = p_screening_id) then
    raise exception 'screening % not found', p_screening_id;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('screening.write') then raise exception 'not_authorized'; end if;

  -- Upsert each provided score row. ON CONFLICT target = plain unique index
  -- (screening_id, criterion_id) [rubric 12].
  insert into public.tas_screening_score (screening_id, criterion_id, score, note)
  select p_screening_id,
         (elem->>'criterion_id')::uuid,
         nullif(elem->>'score','')::numeric,
         nullif(elem->>'note','')
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as elem
  where (elem->>'criterion_id') is not null
  on conflict (screening_id, criterion_id) do update
    set score = excluded.score,
        note  = excluded.note;

  -- Weighted average over scored criteria (score not null). Guard /0 -> null.
  select case when sum(cr.weight) > 0
              then round(sum(ss.score * cr.weight) / sum(cr.weight), 2)
              else null end
    into v_overall
  from public.tas_screening_score ss
  join public.tas_screening_criterion cr on cr.id = ss.criterion_id
  where ss.screening_id = p_screening_id and ss.score is not null;

  update public.tas_screening
    set overall_score = v_overall, updated_by = v_caller
  where id = p_screening_id;

  return v_overall;
end;
$$;

create or replace function public.submit_screening(
  p_screening_id   uuid,
  p_recommendation text,
  p_notes_en       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_scr     public.tas_screening;
  v_stage   uuid;
  v_moved   boolean := false;
  v_message text := '';
begin
  if p_recommendation not in ('shortlist','reject','hold') then
    raise exception 'invalid recommendation %', p_recommendation;
  end if;

  select * into v_scr from public.tas_screening where id = p_screening_id;
  if v_scr.id is null then raise exception 'screening % not found', p_screening_id; end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('screening.write') then raise exception 'not_authorized'; end if;

  update public.tas_screening set
    recommendation = p_recommendation,
    notes_en       = p_notes_en,
    status         = 'submitted',
    screened_by    = coalesce(v_scr.screened_by, v_caller),
    screened_at    = now(),
    updated_by     = v_caller
  where id = p_screening_id;

  if p_recommendation = 'shortlist' then
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and code = 'shortlisted' limit 1;
    if v_stage is null then
      select id into v_stage from public.tas_pipeline_stage
      where status = 'active' and stage_type = 'shortlisted' order by sort_order limit 1;
    end if;
    if v_stage is not null then
      perform public.move_application_stage(v_scr.application_id, v_stage, 'Screening: shortlisted');
      v_moved := true;
    else
      v_message := 'no_shortlist_stage';
    end if;

  elsif p_recommendation = 'reject' then
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and stage_type = 'rejected' order by sort_order limit 1;
    if v_stage is not null then
      -- move_application_stage auto-sets status='rejected' for a rejected stage_type.
      perform public.move_application_stage(v_scr.application_id, v_stage, 'Screening: rejected');
      v_moved := true;
    else
      -- No rejected stage in the pipeline: fall back to status update.
      perform public.set_application_status(v_scr.application_id, 'rejected', 'Screening: rejected');
      v_moved := true;
      v_message := 'rejected_via_status';
    end if;
  end if;

  perform public.audit_log(v_caller, 'M1.6', 'screening.submitted', 'screening', p_screening_id::text,
    jsonb_build_object('recommendation', p_recommendation, 'application_id', v_scr.application_id,
                       'moved', v_moved, 'message', v_message));

  return jsonb_build_object(
    'screening_id', p_screening_id,
    'recommendation', p_recommendation,
    'application_id', v_scr.application_id,
    'moved', v_moved,
    'message', v_message
  );
end;
$$;

-- =============================================================================
-- GRANTS
--   Cat A: ADD EXECUTE to authenticated (were revoked from public in M1.2) — so
--          permitted roles can now call them. The in-RPC _has_permission gates.
--   Cat B: re-assert the existing EXECUTE-to-authenticated grants (idempotent).
-- =============================================================================
grant execute on function public.submit_requisition(uuid)                            to authenticated;
grant execute on function public.transition_requisition(uuid, text)                  to authenticated;
grant execute on function public.upsert_candidate(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_application(uuid, uuid, text)                 to authenticated;
grant execute on function public.move_application_stage(uuid, uuid, text)             to authenticated;
grant execute on function public.set_application_status(uuid, text, text)             to authenticated;
grant execute on function public.create_screening(uuid, uuid)                         to authenticated;
grant execute on function public.save_screening_scores(uuid, jsonb)                   to authenticated;
grant execute on function public.submit_screening(uuid, text, text)                   to authenticated;

-- =============================================================================
-- End of M3.1-step2b-wave2 recruiter-core enforcement flip.
-- =============================================================================
