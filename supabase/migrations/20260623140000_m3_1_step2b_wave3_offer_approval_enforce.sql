-- =============================================================================
-- Al Hamra TAS — M3.1-step2b-wave3: Enforcement flip (offer / interview-score /
-- approval) + the offer.view read gate. FINAL enforcement wave.
-- =============================================================================
-- Flips the remaining sensitive writes to _has_permission(), gates the two
-- ASSIGNMENT-SENSITIVE ops (permission AND assignment), and adds ONE new key
-- (offer.view) gating the salary-sensitive offer READS. SYSTEM_ADMIN bypasses all.
--
-- Verified current-guard categories (read from live source):
--   Cat A — revoked from public (M1.9 offer writes) -> gate + EXECUTE grant:
--     submit_offer(offer.submit), issue_offer(offer.issue),
--     respond_to_offer(offer.respond), transition_offer(offer.write)
--   Cat B — granted authenticated -> gate only:
--     submit_interview_score(interview.score, M1.7) — PANELIST check preserved
--     act_on_task(approval.act, M0.3)               — ASSIGNEE/delegate check preserved
--     offer_detail(offer.view), list_offers(offer.view)  [the READ gate]
--
-- Assignment-sensitive ops add the permission gate ALONGSIDE (not replacing) the
-- existing assignment check — both must pass. offer_detail/list_offers were
-- `language sql`; converted to `language plpgsql` (gate + return/return query,
-- same args + return type + query) so the raise gate is expressible — signatures
-- UNCHANGED. Each function otherwise reproduced VERBATIM. CREATE OR REPLACE
-- (idempotent). No storage bucket SQL. ON CONFLICT: offer.view seed matches the
-- partial key index (predicate repeated, rubric 12); reproduced RPC ON CONFLICTs
-- unchanged. No recursive CTEs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NEW KEY — offer.view + grants (SYSTEM_ADMIN/HR_MANAGER/RECRUITER/
--    HIRING_MANAGER/AUDITOR may see salary; APPROVER/INTERVIEWER do not).
-- -----------------------------------------------------------------------------
insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('offer.view', 'offer', 'View Offers', 'عرض العروض', false)
on conflict (key) where key is not null do nothing;

insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id
from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('RECRUITER'),('HIRING_MANAGER'),('AUDITOR')) as g(role_code)
  on g.role_code = r.code
join public.tas_permission p on p.key = 'offer.view'
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. OFFER WRITES (Cat A — gate + EXECUTE grant)
-- -----------------------------------------------------------------------------
create or replace function public.submit_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer    public.tas_offer;
  v_entity   uuid;
  v_branch   uuid;
  v_dept     uuid;
  v_instance uuid;
  v_cand_en  text;
  v_requester uuid;
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;
  if v_offer.status <> 'draft' then
    raise exception 'only draft offers can be submitted (current: %)', v_offer.status;
  end if;
  if v_offer.salary_amount is null or v_offer.candidate_id is null or v_offer.application_id is null then
    raise exception 'offer is missing required fields (salary, candidate, application)';
  end if;

  if not public._has_permission('offer.submit') then raise exception 'not_authorized'; end if;

  if not exists (
    select 1 from public.tas_workflow_definition where request_type = 'offer' and status = 'active'
  ) then
    insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_offer_id, 'submit_blocked', v_offer.status, v_offer.status, v_offer.created_by,
            jsonb_build_object('reason', 'no active offer workflow definition'));
    raise exception 'no active offer workflow definition';
  end if;

  -- Org context from the application's requisition.
  select r.entity_id, r.branch_id, r.department_id into v_entity, v_branch, v_dept
  from public.tas_application a
  join public.tas_requisition r on r.id = a.requisition_id
  where a.id = v_offer.application_id;

  v_requester := v_offer.created_by;

  -- Hand off to the M0.3 engine. salary_amount in context drives the conditional
  -- high-salary step (eval_condition: salary_amount >= 2000).
  v_instance := public.submit_workflow(
    'offer', p_offer_id::text, v_requester,
    v_entity, v_branch, v_dept,
    jsonb_build_object('salary_amount', v_offer.salary_amount,
                       'contract_type', v_offer.contract_type,
                       'grade', v_offer.job_grade_id)
  );

  update public.tas_offer
    set status = 'in_approval', workflow_instance_id = v_instance, updated_by = v_requester
  where id = p_offer_id;

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, 'submitted', 'draft', 'in_approval', v_requester,
          jsonb_build_object('workflow_instance_id', v_instance));

  perform public.audit_log(v_requester, 'M1.9', 'offer.submitted', 'offer', p_offer_id::text,
    jsonb_build_object('reference', v_offer.reference, 'workflow_instance_id', v_instance));

  select full_name_en into v_cand_en from public.tas_candidate where id = v_offer.candidate_id;
  if v_requester is not null then
    perform public.notify('offer.submitted', array[v_requester],
      jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                         'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                         'status', 'in_approval'),
      '/app/offers/' || p_offer_id::text);
  end if;

  return v_instance;
end;
$$;

create or replace function public.issue_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer   public.tas_offer;
  v_caller  uuid;
  v_cand_en text;
  v_cand_ar text;
  v_snap    jsonb;
  v_esign   text := 'skipped'; -- no esign adapter configured (dormant); see offer-esign edge fn.
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;
  if v_offer.status <> 'approved' then
    raise exception 'only approved offers can be issued (current: %)', v_offer.status
      using message = 'This offer must be approved before it can be issued.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('offer.issue') then raise exception 'not_authorized'; end if;

  select full_name_en, full_name_ar into v_cand_en, v_cand_ar
  from public.tas_candidate where id = v_offer.candidate_id;

  -- Freeze the bilingual letter. No template table yet — build from offer fields +
  -- a default bilingual boilerplate when letter_template_id is null. Template edits
  -- can never mutate this issued snapshot.
  v_snap := jsonb_build_object(
    'reference', v_offer.reference,
    'candidate_en', coalesce(v_cand_en, ''),
    'candidate_ar', coalesce(v_cand_ar, ''),
    'salary_amount', v_offer.salary_amount,
    'currency', v_offer.currency,
    'start_date', v_offer.start_date,
    'contract_type', v_offer.contract_type,
    'employment_type', v_offer.employment_type,
    'probation_months', v_offer.probation_months,
    'terms_en', v_offer.terms_en,
    'terms_ar', v_offer.terms_ar,
    'title_en', 'Offer of Employment',
    'title_ar', 'عرض عمل',
    'body_en', 'Dear ' || coalesce(v_cand_en, 'Candidate') ||
               ', we are pleased to offer you employment with Al Hamra Real Estate Group at a salary of ' ||
               coalesce(v_offer.salary_amount::text, '') || ' ' || v_offer.currency ||
               coalesce(', starting ' || v_offer.start_date::text, '') || '.',
    'body_ar', 'عزيزي ' || coalesce(v_cand_ar, v_cand_en, 'المرشح') ||
               '، يسعدنا أن نقدم لك عرض عمل لدى مجموعة الحمراء العقارية براتب قدره ' ||
               coalesce(v_offer.salary_amount::text, '') || ' ' || v_offer.currency ||
               coalesce('، اعتباراً من ' || v_offer.start_date::text, '') || '.'
  );

  update public.tas_offer
    set status = 'issued', letter_snapshot_json = v_snap, esign_status = v_esign, updated_by = v_caller
  where id = p_offer_id;

  -- Record an M0.5 document for the letter (snapshot lives in the offer; the doc
  -- row links it for DocumentPanel). storage_provider per the M0.5 fallback.
  insert into public.tas_document
    (title, category, linked_entity_type, linked_entity_ref, storage_provider, file_name, status, uploaded_by, created_by)
  values
    ('Offer Letter ' || coalesce(v_offer.reference, ''), 'offer_letter', 'offer', p_offer_id::text,
     'supabase_storage', 'offer-' || coalesce(v_offer.reference, p_offer_id::text) || '.txt',
     'active', v_caller, v_caller);

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, 'issued', 'approved', 'issued', v_caller, jsonb_build_object('esign_status', v_esign));

  perform public.audit_log(v_caller, 'M1.9', 'offer.issued', 'offer', p_offer_id::text,
    jsonb_build_object('reference', v_offer.reference, 'esign_status', v_esign));

  if v_offer.created_by is not null then
    perform public.notify('offer.issued', array[v_offer.created_by],
      jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                         'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                         'status', 'issued'),
      '/app/offers/' || p_offer_id::text);
  end if;
end;
$$;

create or replace function public.respond_to_offer(
  p_offer_id   uuid,
  p_decision   text,
  p_reason     text default null,
  p_signature  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer   public.tas_offer;
  v_caller  uuid;
  v_stage   uuid;
  v_moved   boolean := false;
  v_message text := '';
  v_cand_en text;
  v_esign   text;
begin
  if p_decision not in ('accept','decline') then
    raise exception 'invalid decision %', p_decision;
  end if;

  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;
  if v_offer.status <> 'issued' then
    raise exception 'only issued offers can be responded to (current: %)', v_offer.status
      using message = 'This offer must be issued before recording a response.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('offer.respond') then raise exception 'not_authorized'; end if;

  select full_name_en into v_cand_en from public.tas_candidate where id = v_offer.candidate_id;

  if p_decision = 'accept' then
    v_esign := case when nullif(p_signature,'') is not null then 'signed' else v_offer.esign_status end;
    update public.tas_offer
      set status = 'accepted', accepted_at = now(), esign_status = v_esign,
          onboarding_ready = true, updated_by = v_caller
    where id = p_offer_id;

    -- Advance the application to a hired/offer-accepted stage (M1.5).
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and (stage_type = 'hired' or code = 'hired') order by sort_order limit 1;
    if v_stage is not null then
      perform public.move_application_stage(v_offer.application_id, v_stage, 'Offer accepted');
      v_moved := true;
    else
      perform public.set_application_status(v_offer.application_id, 'hired', 'Offer accepted');
      v_moved := true;
      v_message := 'hired_via_status';
    end if;

    insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_offer_id, 'accepted', 'issued', 'accepted', v_caller,
            jsonb_build_object('moved', v_moved, 'message', v_message));

    perform public.audit_log(v_caller, 'M1.9', 'offer.accepted', 'offer', p_offer_id::text,
      jsonb_build_object('reference', v_offer.reference, 'moved', v_moved));

    if v_offer.created_by is not null then
      perform public.notify('offer.accepted', array[v_offer.created_by],
        jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                           'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                           'status', 'accepted'),
        '/app/offers/' || p_offer_id::text);
    end if;

  else -- decline
    update public.tas_offer
      set status = 'declined', declined_reason = p_reason, updated_by = v_caller
    where id = p_offer_id;

    insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_offer_id, 'declined', 'issued', 'declined', v_caller, jsonb_build_object('reason', p_reason));

    perform public.audit_log(v_caller, 'M1.9', 'offer.declined', 'offer', p_offer_id::text,
      jsonb_build_object('reference', v_offer.reference, 'reason', p_reason));

    if v_offer.created_by is not null then
      perform public.notify('offer.declined', array[v_offer.created_by],
        jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                           'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                           'status', 'declined'),
        '/app/offers/' || p_offer_id::text);
    end if;
  end if;

  return jsonb_build_object('offer_id', p_offer_id, 'decision', p_decision,
                            'application_id', v_offer.application_id, 'moved', v_moved, 'message', v_message);
end;
$$;

create or replace function public.transition_offer(p_offer_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer  public.tas_offer;
  v_new    text;
  v_caller uuid;
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;

  v_new := case p_action
    when 'cancel' then 'cancelled'
    when 'expire' then 'expired'
    else null
  end;
  if v_new is null then raise exception 'invalid action %', p_action; end if;

  -- Guard: cannot cancel/expire an already-terminal offer.
  if v_offer.status in ('accepted','declined','cancelled','expired') then
    raise exception 'cannot % an offer in status %', p_action, v_offer.status
      using message = 'This offer is already finalized.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('offer.write') then raise exception 'not_authorized'; end if;

  update public.tas_offer set status = v_new, updated_by = v_caller where id = p_offer_id;

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, p_action, v_offer.status, v_new, v_caller, '{}'::jsonb);

  perform public.audit_log(v_caller, 'M1.9', 'offer.' || p_action, 'offer', p_offer_id::text,
    jsonb_build_object('from', v_offer.status, 'to', v_new));
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. OFFER READS (Cat B — gate offer.view). Were `language sql`; converted to
--    `language plpgsql` (minimal wrapper) so the raise gate is expressible.
--    Signature (args + return type) + query logic UNCHANGED.
-- -----------------------------------------------------------------------------
create or replace function public.offer_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._has_permission('offer.view') then raise exception 'not_authorized'; end if;
  return (
    select jsonb_build_object(
      'offer', (select to_jsonb(o) from public.tas_offer o where o.id = p_id),
      'application', (
        select jsonb_build_object('id', a.id, 'reference', a.reference, 'status', a.status,
                                  'current_stage_id', a.current_stage_id)
        from public.tas_application a
        join public.tas_offer o on o.application_id = a.id where o.id = p_id
      ),
      'candidate', (
        select jsonb_build_object('id', c.id, 'full_name_en', c.full_name_en,
                                  'full_name_ar', c.full_name_ar, 'email', c.email)
        from public.tas_candidate c
        join public.tas_offer o on o.candidate_id = c.id where o.id = p_id
      ),
      'instance', (
        select jsonb_build_object('instance', to_jsonb(i))
        from public.tas_workflow_instance i
        join public.tas_offer o on o.workflow_instance_id = i.id where o.id = p_id
      ),
      'letter_snapshot', (select o.letter_snapshot_json from public.tas_offer o where o.id = p_id),
      'events', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'event_type', e.event_type, 'from_status', e.from_status,
          'to_status', e.to_status, 'created_at', e.created_at
        ) order by e.created_at)
        from public.tas_offer_event e where e.offer_id = p_id
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.list_offers(
  p_application_id uuid    default null,
  p_candidate_id   uuid    default null,
  p_status         text    default null,
  p_mine           boolean default false,
  p_limit          int     default 50,
  p_offset         int     default 0
)
returns table(
  id                uuid,
  reference         text,
  application_id    uuid,
  candidate_id      uuid,
  candidate_name_en text,
  candidate_name_ar text,
  salary_amount     numeric,
  currency          text,
  status            text,
  esign_status      text,
  onboarding_ready  boolean,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._has_permission('offer.view') then raise exception 'not_authorized'; end if;
  return query
  with me as (
    select u.id from public.tas_user u
    where u.entra_object_id = (auth.jwt() ->> 'oid')
       or u.email = nullif(auth.jwt() ->> 'email','')::citext
    limit 1
  )
  select o.id, o.reference, o.application_id, o.candidate_id,
         c.full_name_en, c.full_name_ar, o.salary_amount, o.currency, o.status,
         o.esign_status, o.onboarding_ready, o.created_at
  from public.tas_offer o
  left join public.tas_candidate c on c.id = o.candidate_id
  where (p_application_id is null or o.application_id = p_application_id)
    and (p_candidate_id is null or o.candidate_id = p_candidate_id)
    and (p_status is null or o.status = p_status)
    and (not coalesce(p_mine, false) or o.created_by in (select id from me))
  order by o.created_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. ASSIGNMENT-SENSITIVE OPS (Cat B — add permission gate, PRESERVE assignment)
-- -----------------------------------------------------------------------------

-- submit_interview_score (M1.7): interview.score ADDED; panelist check PRESERVED.
create or replace function public.submit_interview_score(
  p_interview_id   uuid,
  p_scores         jsonb,
  p_recommendation text default null,
  p_notes_en       text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid;
  v_card     uuid;
  v_score_id uuid;
  v_overall  numeric;
begin
  if p_recommendation is not null and p_recommendation not in ('proceed','reject','hold') then
    raise exception 'invalid recommendation %', p_recommendation;
  end if;

  select scorecard_id into v_card from public.tas_interview where id = p_interview_id;
  if not found then raise exception 'interview % not found', p_interview_id; end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('interview.score') then raise exception 'not_authorized'; end if;

  -- Membership guard: once signed in, the caller must be a panelist on this
  -- interview. When v_caller is null (pre-Entra/service-role), allow (dormant).
  if v_caller is not null and not exists (
    select 1 from public.tas_interview_panelist
    where interview_id = p_interview_id and user_id = v_caller
  ) then
    raise exception 'caller is not a panelist on interview %', p_interview_id;
  end if;

  -- Upsert the panelist's score header. ON CONFLICT target = plain unique index
  -- (interview_id, panelist_user_id) [rubric 12].
  insert into public.tas_interview_score
    (interview_id, panelist_user_id, scorecard_id, recommendation, notes_en, submitted_at, created_by)
  values
    (p_interview_id, v_caller, v_card, p_recommendation, p_notes_en, now(), v_caller)
  on conflict (interview_id, panelist_user_id) do update
    set scorecard_id   = excluded.scorecard_id,
        recommendation = excluded.recommendation,
        notes_en       = excluded.notes_en,
        submitted_at   = now(),
        updated_by     = excluded.created_by
  returning id into v_score_id;

  -- Upsert criterion details. ON CONFLICT target = plain unique index
  -- (interview_score_id, criterion_id) [rubric 12].
  insert into public.tas_interview_score_detail (interview_score_id, criterion_id, score, note)
  select v_score_id,
         (elem->>'criterion_id')::uuid,
         nullif(elem->>'score','')::numeric,
         nullif(elem->>'note','')
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as elem
  where (elem->>'criterion_id') is not null
  on conflict (interview_score_id, criterion_id) do update
    set score = excluded.score,
        note  = excluded.note;

  -- Weighted average over scored criteria (guard /0 -> null).
  select case when sum(cr.weight) > 0
              then round(sum(d.score * cr.weight) / sum(cr.weight), 2)
              else null end
    into v_overall
  from public.tas_interview_score_detail d
  join public.tas_screening_criterion cr on cr.id = d.criterion_id
  where d.interview_score_id = v_score_id and d.score is not null;

  update public.tas_interview_score
    set overall_score = v_overall, updated_by = v_caller
  where id = v_score_id;

  perform public.audit_log(v_caller, 'M1.7', 'interview.scored', 'interview', p_interview_id::text,
    jsonb_build_object('overall', v_overall, 'recommendation', p_recommendation));

  return v_overall;
end;
$$;

-- act_on_task (M0.3): approval.act ADDED; assignee/delegate check PRESERVED.
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

  -- Resolve caller from JWT (null when invoked with the service-role key).
  select u.id into v_caller
  from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('approval.act') then raise exception 'not_authorized'; end if;

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
      -- Quorum met: retire remaining pending tasks of this step, then advance.
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

    -- Retire sibling pending tasks of this step.
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

-- =============================================================================
-- 5. GRANTS
--   Cat A offer writes: ADD EXECUTE to authenticated (were revoked from public).
--   Cat B: re-assert existing EXECUTE-to-authenticated grants (idempotent).
-- =============================================================================
grant execute on function public.submit_offer(uuid)                       to authenticated;
grant execute on function public.issue_offer(uuid)                        to authenticated;
grant execute on function public.respond_to_offer(uuid, text, text, text) to authenticated;
grant execute on function public.transition_offer(uuid, text)             to authenticated;
grant execute on function public.offer_detail(uuid)                       to authenticated;
grant execute on function public.list_offers(uuid, uuid, text, boolean, int, int) to authenticated;
grant execute on function public.submit_interview_score(uuid, jsonb, text, text)  to authenticated;
grant execute on function public.act_on_task(uuid, text, text, text, uuid)        to authenticated;

-- =============================================================================
-- End of M3.1-step2b-wave3 — enforcement flip complete.
-- =============================================================================
