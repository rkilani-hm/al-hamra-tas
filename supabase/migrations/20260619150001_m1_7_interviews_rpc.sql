-- =============================================================================
-- Al Hamra TAS — Module M1.7 RPCs: Interview Management
-- =============================================================================
-- SECURITY DEFINER, transactional. Recruiters schedule; panelists score their own.
-- Outcomes drive the application via the EXISTING M1.5 move_application_stage /
-- set_application_status — NO workflow engine. Notifications fire via M0.4 notify().
-- M365 calendar/Teams creation is delegated to the dormant interview-schedule edge
-- function, invoked best-effort by the frontend AFTER these RPCs return (pg_net is
-- NOT assumed installed, mirroring notification-dispatch).
--
-- Caller resolution mirrors M1.5/M1.6 (auth.jwt() oid/email -> tas_user.id,
-- nullable until Entra sign-in). audit_log + notify signatures match M0.x.
-- ON CONFLICT targets match plain unique indexes (rubric 12). No recursive CTEs.
-- No storage bucket SQL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. schedule_interview — create interview + panel, set calendar_status, move to
--    an Interview stage (best-effort), notify panelists. Returns interview id.
-- -----------------------------------------------------------------------------
create or replace function public.schedule_interview(
  p_application_id uuid,
  p_round_type     text,
  p_scheduled_at   timestamptz,
  p_duration_min   int,
  p_mode           text,
  p_location       text,
  p_panelist_ids   uuid[],
  p_scorecard_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_card    uuid;
  v_cal     text := 'skipped';
  v_stage   uuid;
  v_id      uuid;
  v_pid     uuid;
  v_ref     text;
  v_cand_en text;
  v_recips  uuid[];
begin
  if not exists (select 1 from public.tas_application where id = p_application_id) then
    raise exception 'application % not found', p_application_id;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  -- Scorecard: explicit, else reuse the M1.6 default.
  v_card := p_scorecard_id;
  if v_card is null then
    select id into v_card from public.tas_screening_scorecard
    where status = 'active' and code = 'DEFAULT_SCREENING' limit 1;
  end if;

  -- Calendar adapter live? If any of outlook/teams is enabled+configured, leave
  -- calendar_status='none' for the edge fn to set 'created'/'failed'; else 'skipped'.
  if exists (
    select 1 from public.tas_comm_adapter_config
    where channel in ('outlook_email','teams') and is_enabled and config_status = 'configured'
  ) then
    v_cal := 'none';
  end if;

  insert into public.tas_interview
    (application_id, round_type, scheduled_at, duration_min, mode, location,
     status, calendar_status, scorecard_id, scheduled_by, created_by)
  values
    (p_application_id, p_round_type, p_scheduled_at, coalesce(p_duration_min, 60),
     coalesce(p_mode, 'onsite'), p_location, 'scheduled', v_cal, v_card, v_caller, v_caller)
  returning id, reference into v_id, v_ref;

  -- Panel members (dedupe nulls).
  if p_panelist_ids is not null then
    foreach v_pid in array p_panelist_ids loop
      if v_pid is null then continue; end if;
      insert into public.tas_interview_panelist (interview_id, user_id, created_by)
      values (v_id, v_pid, v_caller)
      on conflict (interview_id, user_id) do nothing;
    end loop;
  end if;

  -- Best-effort move the application to an Interview-type stage (no crash if none).
  select id into v_stage from public.tas_pipeline_stage
  where status = 'active' and (stage_type = 'interview' or code = 'interview')
  order by sort_order limit 1;
  if v_stage is not null then
    perform public.move_application_stage(p_application_id, v_stage, 'Interview scheduled');
  end if;

  -- Notify panelists.
  select c.full_name_en into v_cand_en
  from public.tas_application a join public.tas_candidate c on c.id = a.candidate_id
  where a.id = p_application_id;

  select array_agg(user_id) into v_recips
  from public.tas_interview_panelist where interview_id = v_id;

  perform public.notify('interview.scheduled', v_recips,
    jsonb_build_object(
      'reference', v_ref,
      'candidate', coalesce(v_cand_en, ''),
      'datetime', coalesce(to_char(p_scheduled_at, 'YYYY-MM-DD HH24:MI'), ''),
      'mode', coalesce(p_mode, 'onsite')
    ),
    '/app/interviews/' || v_id::text);

  perform public.audit_log(v_caller, 'M1.7', 'interview.scheduled', 'interview', v_id::text,
    jsonb_build_object('application_id', p_application_id, 'mode', p_mode,
                       'calendar_status', v_cal, 'stage_moved', v_stage is not null));

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. submit_interview_score — per-panelist scorecard; weighted overall.
--    Caller must be a panelist on the interview (enforced once signed in; when
--    currentUserId is null pre-Entra, service-role/dormant path is allowed).
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. record_interview_outcome — set outcome + complete; drive M1.5 pipeline.
-- -----------------------------------------------------------------------------
create or replace function public.record_interview_outcome(
  p_interview_id uuid,
  p_outcome      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_iv      public.tas_interview;
  v_stage   uuid;
  v_moved   boolean := false;
  v_message text := '';
  v_ref     text;
  v_cand_en text;
  v_recips  uuid[];
begin
  if p_outcome not in ('proceed','reject','hold') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  select * into v_iv from public.tas_interview where id = p_interview_id;
  if v_iv.id is null then raise exception 'interview % not found', p_interview_id; end if;
  if v_iv.status = 'cancelled' then
    raise exception 'cannot record an outcome for a cancelled interview'
      using message = 'This interview was cancelled; reopen or schedule a new one.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_interview
    set outcome = p_outcome, status = 'completed', updated_by = v_caller
  where id = p_interview_id;

  if p_outcome = 'proceed' then
    -- Move to a post-interview (offer) stage if resolvable; else leave + record.
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and (stage_type = 'offer' or code = 'offer')
    order by sort_order limit 1;
    if v_stage is not null then
      perform public.move_application_stage(v_iv.application_id, v_stage, 'Interview: proceed');
      v_moved := true;
    else
      v_message := 'no_next_stage';
    end if;

  elsif p_outcome = 'reject' then
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and stage_type = 'rejected' order by sort_order limit 1;
    if v_stage is not null then
      perform public.move_application_stage(v_iv.application_id, v_stage, 'Interview: rejected');
      v_moved := true;
    else
      perform public.set_application_status(v_iv.application_id, 'rejected', 'Interview: rejected');
      v_moved := true;
      v_message := 'rejected_via_status';
    end if;
  end if;

  -- Notify panel + scheduler.
  select reference into v_ref from public.tas_interview where id = p_interview_id;
  select c.full_name_en into v_cand_en
  from public.tas_application a join public.tas_candidate c on c.id = a.candidate_id
  where a.id = v_iv.application_id;

  select array_remove(
           coalesce(array_agg(user_id), array[]::uuid[]) || array[v_iv.scheduled_by],
           null) into v_recips
  from public.tas_interview_panelist where interview_id = p_interview_id;

  perform public.notify('interview.completed', v_recips,
    jsonb_build_object('reference', coalesce(v_ref,''), 'candidate', coalesce(v_cand_en,''),
                       'datetime', coalesce(to_char(v_iv.scheduled_at, 'YYYY-MM-DD HH24:MI'),''),
                       'mode', v_iv.mode),
    '/app/interviews/' || p_interview_id::text);

  perform public.audit_log(v_caller, 'M1.7', 'interview.outcome', 'interview', p_interview_id::text,
    jsonb_build_object('outcome', p_outcome, 'application_id', v_iv.application_id,
                       'moved', v_moved, 'message', v_message));

  return jsonb_build_object('interview_id', p_interview_id, 'outcome', p_outcome,
                            'application_id', v_iv.application_id, 'moved', v_moved, 'message', v_message);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. reschedule_interview — update scheduled_at; notify; (edge fn best-effort).
-- -----------------------------------------------------------------------------
create or replace function public.reschedule_interview(
  p_interview_id uuid,
  p_new_datetime timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_iv      public.tas_interview;
  v_cand_en text;
  v_recips  uuid[];
begin
  select * into v_iv from public.tas_interview where id = p_interview_id;
  if v_iv.id is null then raise exception 'interview % not found', p_interview_id; end if;
  if v_iv.status in ('completed','cancelled') then
    raise exception 'cannot reschedule a % interview', v_iv.status
      using message = 'This interview is already completed or cancelled.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_interview
    set scheduled_at = p_new_datetime, updated_by = v_caller
  where id = p_interview_id;

  select c.full_name_en into v_cand_en
  from public.tas_application a join public.tas_candidate c on c.id = a.candidate_id
  where a.id = v_iv.application_id;

  select array_agg(user_id) into v_recips
  from public.tas_interview_panelist where interview_id = p_interview_id;

  perform public.notify('interview.rescheduled', v_recips,
    jsonb_build_object('reference', coalesce(v_iv.reference,''), 'candidate', coalesce(v_cand_en,''),
                       'datetime', coalesce(to_char(p_new_datetime, 'YYYY-MM-DD HH24:MI'),''),
                       'mode', v_iv.mode),
    '/app/interviews/' || p_interview_id::text);

  perform public.audit_log(v_caller, 'M1.7', 'interview.rescheduled', 'interview', p_interview_id::text,
    jsonb_build_object('new_datetime', p_new_datetime));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. cancel_interview — status='cancelled'; notify; audit.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_interview(
  p_interview_id uuid,
  p_reason       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_iv      public.tas_interview;
  v_cand_en text;
  v_recips  uuid[];
begin
  select * into v_iv from public.tas_interview where id = p_interview_id;
  if v_iv.id is null then raise exception 'interview % not found', p_interview_id; end if;
  if v_iv.status = 'completed' then
    raise exception 'cannot cancel a completed interview'
      using message = 'This interview is already completed.';
  end if;
  if v_iv.status = 'cancelled' then
    return; -- idempotent
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_interview
    set status = 'cancelled', updated_by = v_caller
  where id = p_interview_id;

  select c.full_name_en into v_cand_en
  from public.tas_application a join public.tas_candidate c on c.id = a.candidate_id
  where a.id = v_iv.application_id;

  select array_agg(user_id) into v_recips
  from public.tas_interview_panelist where interview_id = p_interview_id;

  perform public.notify('interview.cancelled', v_recips,
    jsonb_build_object('reference', coalesce(v_iv.reference,''), 'candidate', coalesce(v_cand_en,''),
                       'datetime', coalesce(to_char(v_iv.scheduled_at, 'YYYY-MM-DD HH24:MI'),''),
                       'mode', v_iv.mode),
    '/app/interviews/' || p_interview_id::text);

  perform public.audit_log(v_caller, 'M1.7', 'interview.cancelled', 'interview', p_interview_id::text,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. interview_detail — interview + panelists + scores(+details) + app/candidate
--    summary + the scorecard criteria (for a blank panelist scorecard).
-- -----------------------------------------------------------------------------
create or replace function public.interview_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'interview', (
      select to_jsonb(i) from public.tas_interview i where i.id = p_id
    ),
    'application', (
      select jsonb_build_object('id', a.id, 'reference', a.reference, 'status', a.status,
                                'current_stage_id', a.current_stage_id)
      from public.tas_application a
      join public.tas_interview i on i.application_id = a.id where i.id = p_id
    ),
    'candidate', (
      select jsonb_build_object('id', c.id, 'full_name_en', c.full_name_en,
                                'full_name_ar', c.full_name_ar, 'email', c.email)
      from public.tas_candidate c
      join public.tas_application a on a.candidate_id = c.id
      join public.tas_interview i on i.application_id = a.id where i.id = p_id
    ),
    'panelists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'user_id', p.user_id, 'role', p.role,
        'name_en', u.display_name_en, 'name_ar', u.display_name_ar, 'email', u.email
      ) order by u.display_name_en)
      from public.tas_interview_panelist p
      left join public.tas_user u on u.id = p.user_id
      where p.interview_id = p_id
    ), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'panelist_user_id', s.panelist_user_id,
        'panelist_name_en', u.display_name_en, 'panelist_name_ar', u.display_name_ar,
        'overall_score', s.overall_score, 'recommendation', s.recommendation,
        'notes_en', s.notes_en, 'submitted_at', s.submitted_at,
        'details', coalesce((
          select jsonb_agg(jsonb_build_object(
            'criterion_id', d.criterion_id, 'score', d.score, 'note', d.note
          ))
          from public.tas_interview_score_detail d where d.interview_score_id = s.id
        ), '[]'::jsonb)
      ) order by s.created_at)
      from public.tas_interview_score s
      left join public.tas_user u on u.id = s.panelist_user_id
      where s.interview_id = p_id
    ), '[]'::jsonb),
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'criterion_id', cr.id, 'code', cr.code, 'name_en', cr.name_en, 'name_ar', cr.name_ar,
        'weight', cr.weight, 'max_score', cr.max_score, 'sort_order', cr.sort_order
      ) order by cr.sort_order, cr.code)
      from public.tas_screening_criterion cr
      join public.tas_interview i on i.scorecard_id = cr.scorecard_id
      where i.id = p_id
    ), '[]'::jsonb)
  );
$$;

-- -----------------------------------------------------------------------------
-- 7. list_interviews — filtered, paged. p_mine = caller is a panelist.
-- -----------------------------------------------------------------------------
create or replace function public.list_interviews(
  p_application_id uuid        default null,
  p_status         text        default null,
  p_mine           boolean     default false,
  p_from           timestamptz default null,
  p_to             timestamptz default null,
  p_limit          int         default 50,
  p_offset         int         default 0
)
returns table(
  id                uuid,
  reference         text,
  application_id    uuid,
  application_ref   text,
  candidate_name_en text,
  candidate_name_ar text,
  round_type        text,
  scheduled_at      timestamptz,
  duration_min      int,
  mode              text,
  location          text,
  status            text,
  calendar_status   text,
  outcome           text,
  teams_join_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id from public.tas_user u
    where u.entra_object_id = (auth.jwt() ->> 'oid')
       or u.email = nullif(auth.jwt() ->> 'email','')::citext
    limit 1
  )
  select i.id, i.reference, i.application_id, a.reference,
         c.full_name_en, c.full_name_ar, i.round_type, i.scheduled_at, i.duration_min,
         i.mode, i.location, i.status, i.calendar_status, i.outcome, i.teams_join_url
  from public.tas_interview i
  left join public.tas_application a on a.id = i.application_id
  left join public.tas_candidate c   on c.id = a.candidate_id
  where (p_application_id is null or i.application_id = p_application_id)
    and (p_status is null or i.status = p_status)
    and (p_from is null or i.scheduled_at >= p_from)
    and (p_to is null or i.scheduled_at <= p_to)
    and (
      not coalesce(p_mine, false)
      or exists (
        select 1 from public.tas_interview_panelist p
        where p.interview_id = i.id and p.user_id in (select id from me)
      )
    )
  order by i.scheduled_at desc nulls last, i.created_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- 8. interview_panel_summary — aggregated panel scores.
-- -----------------------------------------------------------------------------
create or replace function public.interview_panel_summary(p_interview_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'interview_id', p_interview_id,
    'panel_average', (
      select round(avg(overall_score), 2)
      from public.tas_interview_score
      where interview_id = p_interview_id and overall_score is not null
    ),
    'panelist_count', (
      select count(*) from public.tas_interview_score where interview_id = p_interview_id
    ),
    'panelists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'panelist_user_id', s.panelist_user_id,
        'name_en', u.display_name_en, 'name_ar', u.display_name_ar,
        'overall_score', s.overall_score, 'recommendation', s.recommendation,
        'submitted_at', s.submitted_at
      ) order by s.created_at)
      from public.tas_interview_score s
      left join public.tas_user u on u.id = s.panelist_user_id
      where s.interview_id = p_interview_id
    ), '[]'::jsonb)
  );
$$;

-- -----------------------------------------------------------------------------
-- 9. EXECUTE grants to authenticated (recruiter + panelist operations).
-- -----------------------------------------------------------------------------
grant execute on function public.schedule_interview(uuid, text, timestamptz, int, text, text, uuid[], uuid) to authenticated;
grant execute on function public.submit_interview_score(uuid, jsonb, text, text)  to authenticated;
grant execute on function public.record_interview_outcome(uuid, text)             to authenticated;
grant execute on function public.reschedule_interview(uuid, timestamptz)          to authenticated;
grant execute on function public.cancel_interview(uuid, text)                     to authenticated;
grant execute on function public.interview_detail(uuid)                           to authenticated;
grant execute on function public.list_interviews(uuid, text, boolean, timestamptz, timestamptz, int, int) to authenticated;
grant execute on function public.interview_panel_summary(uuid)                    to authenticated;

-- =============================================================================
-- End of M1.7 RPCs.
-- =============================================================================
