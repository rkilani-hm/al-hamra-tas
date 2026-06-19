-- =============================================================================
-- Al Hamra TAS — Module M1.6 RPCs: Screening & Shortlisting
-- =============================================================================
-- SECURITY DEFINER, transactional. Recruiters operate screening (authenticated
-- EXECUTE). submit_screening drives the application stage via the EXISTING M1.5
-- RPCs (move_application_stage / set_application_status) — NO rebuilt ATS logic,
-- NO workflow engine.
--
-- Caller resolution mirrors M1.5: map auth.jwt() oid/email -> tas_user.id
-- (nullable; screened_by stays null until Entra sign-in is wired — no crash).
-- audit_log signature (caller, module, action, entity_type, entity_ref, payload)
-- matches M1.5. ON CONFLICT (screening_id, criterion_id) targets a PLAIN unique
-- index (rubric 12). No storage bucket SQL. No recursive CTEs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. list_screening_scorecards() — active scorecards + their ordered criteria.
-- -----------------------------------------------------------------------------
create or replace function public.list_screening_scorecards()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(card order by card->>'code'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', sc.id,
      'code', sc.code,
      'name_en', sc.name_en,
      'name_ar', sc.name_ar,
      'description_en', sc.description_en,
      'description_ar', sc.description_ar,
      'status', sc.status,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cr.id,
          'code', cr.code,
          'name_en', cr.name_en,
          'name_ar', cr.name_ar,
          'weight', cr.weight,
          'max_score', cr.max_score,
          'sort_order', cr.sort_order
        ) order by cr.sort_order, cr.code)
        from public.tas_screening_criterion cr
        where cr.scorecard_id = sc.id
      ), '[]'::jsonb)
    ) as card
    from public.tas_screening_scorecard sc
    where sc.status = 'active'
  ) cards;
$$;

-- -----------------------------------------------------------------------------
-- 2. create_screening(p_application_id, p_scorecard_id) — draft for an app.
--    Reuses an existing OPEN draft for the application if one exists (one active
--    draft per application — spec edge case), else creates a new draft.
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

-- -----------------------------------------------------------------------------
-- 3. save_screening_scores(p_screening_id, p_scores jsonb)
--    p_scores = [{criterion_id, score, note}, ...]. Upserts score rows, then
--    recomputes overall_score = weighted average (criterion.weight) over scored
--    (non-null) criteria. Divide-by-zero guarded -> overall null.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. submit_screening(p_screening_id, p_recommendation, p_notes_en)
--    Finalize the screening, then act on the application via M1.5:
--      'shortlist' -> move to the 'shortlisted' stage (by code, then stage_type)
--      'reject'    -> move to a stage_type='rejected' stage (status auto-sets via
--                     move_application_stage); fallback set_application_status.
--      'hold'      -> record only, no stage change.
--    Missing target stage: record + skip move (no crash) — surfaced via return.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. screening_detail(p_application_id) — the application's screening record(s)
--    + scores + the scorecard criteria (for display).
-- -----------------------------------------------------------------------------
create or replace function public.screening_detail(p_application_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(rec order by rec->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', s.id,
      'application_id', s.application_id,
      'scorecard_id', s.scorecard_id,
      'scorecard_name_en', sc.name_en,
      'scorecard_name_ar', sc.name_ar,
      'overall_score', s.overall_score,
      'recommendation', s.recommendation,
      'notes_en', s.notes_en,
      'status', s.status,
      'screened_by', s.screened_by,
      'screened_by_name_en', su.display_name_en,
      'screened_by_name_ar', su.display_name_ar,
      'screened_at', s.screened_at,
      'created_at', s.created_at,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'criterion_id', cr.id,
          'code', cr.code,
          'name_en', cr.name_en,
          'name_ar', cr.name_ar,
          'weight', cr.weight,
          'max_score', cr.max_score,
          'sort_order', cr.sort_order,
          'score', ss.score,
          'note', ss.note
        ) order by cr.sort_order, cr.code)
        from public.tas_screening_criterion cr
        left join public.tas_screening_score ss
          on ss.criterion_id = cr.id and ss.screening_id = s.id
        where cr.scorecard_id = s.scorecard_id
      ), '[]'::jsonb)
    ) as rec
    from public.tas_screening s
    left join public.tas_screening_scorecard sc on sc.id = s.scorecard_id
    left join public.tas_user su on su.id = s.screened_by
    where s.application_id = p_application_id
  ) recs;
$$;

-- -----------------------------------------------------------------------------
-- 6. EXECUTE grants to authenticated (recruiter operations).
--    Scorecard / criteria CONFIG writes stay service-role until M3.1.
-- -----------------------------------------------------------------------------
grant execute on function public.list_screening_scorecards()                      to authenticated;
grant execute on function public.create_screening(uuid, uuid)                     to authenticated;
grant execute on function public.save_screening_scores(uuid, jsonb)               to authenticated;
grant execute on function public.submit_screening(uuid, text, text)               to authenticated;
grant execute on function public.screening_detail(uuid)                           to authenticated;

-- =============================================================================
-- End of M1.6 RPCs.
-- =============================================================================
