-- =============================================================================
-- Al Hamra TAS — Module M1.5 (corrective): realign applied RPCs to OUR design
-- =============================================================================
-- When the original M1.5 migration was rejected (42P10) and re-applied, Lovable
-- authored its OWN RPC surface (migration 20260619115745_*) that DIVERGES from
-- our committed 20260619120001_m1_5_applications_rpc.sql:
--   * list_applications has different args (p_candidate_id/p_owner_id) and a BARE
--     return (no enriched candidate/stage/requisition names) — our frontend needs
--     the enriched form with p_candidate_search + p_mine.
--   * list_pipeline_stages is MISSING — our frontend calls it.
--   * application_detail history lacks resolved stage names — our frontend reads
--     history[].from_stage/.to_stage name objects.
--   * Lovable added list_candidates() + applications_for_candidate() RPCs that our
--     frontend does NOT use (it reads tas_candidate/tas_application directly).
--
-- This migration makes the DB match OUR committed design (the reviewed source of
-- truth). It is idempotent, SECURITY DEFINER, and re-grants execute to
-- authenticated for the user-facing read RPCs — exactly as 20260619120001 intended.
--
-- Rubric: no upsert/ON-CONFLICT clauses (rule 12 n/a); no recursive CTEs
-- (single-UNION n/a); does not reference the storage bucket table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. list_applications — DROP Lovable's overload (its return columns + arg types
--    differ, so CREATE OR REPLACE cannot change them), then CREATE ours.
--    Lovable signature: (p_requisition_id uuid, p_candidate_id uuid, p_stage_id uuid,
--                        p_status text, p_owner_id uuid, p_limit int, p_offset int)
-- -----------------------------------------------------------------------------
-- Drop EVERY existing list_applications overload (signature-agnostic) so the
-- corrective CREATE below cannot collide with a lingering overload — robust even
-- if the applied signature differs subtly (int/integer, arg order) from what we
-- expect. Applied signature was (uuid,uuid,uuid,text,uuid,int,int) per the apply
-- mirror 20260619115745_*; this loop drops it regardless.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.proname = 'list_applications'
      and p.pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig::text;
  end loop;
end $$;

create or replace function public.list_applications(
  p_requisition_id   uuid    default null,
  p_stage_id         uuid    default null,
  p_status           text    default null,
  p_candidate_search text    default null,
  p_mine             boolean default false,
  p_limit            int     default 50,
  p_offset           int     default 0
)
returns table(
  id                    uuid,
  reference             text,
  requisition_id        uuid,
  requisition_reference text,
  candidate_id          uuid,
  candidate_name_en     text,
  candidate_name_ar     text,
  current_stage_id      uuid,
  stage_name_en         text,
  stage_name_ar         text,
  stage_type            text,
  status                text,
  owner_user_id         uuid,
  applied_at            timestamptz,
  created_at            timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.reference, a.requisition_id, r.reference, a.candidate_id,
         c.full_name_en, c.full_name_ar, a.current_stage_id, s.name_en, s.name_ar, s.stage_type,
         a.status, a.owner_user_id, a.applied_at, a.created_at
  from public.tas_application a
  left join public.tas_requisition r     on r.id = a.requisition_id
  left join public.tas_candidate c       on c.id = a.candidate_id
  left join public.tas_pipeline_stage s  on s.id = a.current_stage_id
  where (p_requisition_id is null or a.requisition_id = p_requisition_id)
    and (p_stage_id is null or a.current_stage_id = p_stage_id)
    and (p_status is null or a.status = p_status)
    and (
      p_candidate_search is null or p_candidate_search = ''
      or c.full_name_en ilike '%' || p_candidate_search || '%'
      or c.full_name_ar ilike '%' || p_candidate_search || '%'
      or c.email ilike ('%' || p_candidate_search || '%')::citext
    )
    and (
      not coalesce(p_mine, false)
      or a.owner_user_id in (
        select u.id from public.tas_user u
        where u.entra_object_id = (auth.jwt() ->> 'oid')
           or u.email = nullif(auth.jwt() ->> 'email','')::citext
      )
    )
  order by a.created_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- 2. list_pipeline_stages — MISSING in the applied DB; create OUR version.
-- -----------------------------------------------------------------------------
create or replace function public.list_pipeline_stages()
returns table(
  id          uuid,
  code        text,
  name_en     text,
  name_ar     text,
  sort_order  int,
  stage_type  text,
  is_terminal boolean,
  status      text
)
language sql
stable
security definer
set search_path = public
as $$
  select id, code, name_en, name_ar, sort_order, stage_type, is_terminal, status
  from public.tas_pipeline_stage
  where status = 'active'
  order by sort_order;
$$;

-- -----------------------------------------------------------------------------
-- 3. application_detail — same signature/return (jsonb), but OUR body resolves
--    from_stage/to_stage names in the history (the frontend renders them).
--    CREATE OR REPLACE is safe (return type unchanged).
-- -----------------------------------------------------------------------------
create or replace function public.application_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'application', (select to_jsonb(a) from public.tas_application a where a.id = p_id),
    'candidate', (
      select to_jsonb(c) from public.tas_candidate c
      join public.tas_application a on a.candidate_id = c.id where a.id = p_id
    ),
    'current_stage', (
      select to_jsonb(s) from public.tas_pipeline_stage s
      join public.tas_application a on a.current_stage_id = s.id where a.id = p_id
    ),
    'requisition', (
      select jsonb_build_object('id', r.id, 'reference', r.reference,
                                'title_en', r.title_en, 'title_ar', r.title_ar, 'status', r.status)
      from public.tas_requisition r
      join public.tas_application a on a.requisition_id = r.id where a.id = p_id
    ),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'from_stage_id', h.from_stage_id, 'to_stage_id', h.to_stage_id,
        'note', h.note, 'moved_by', h.moved_by, 'created_at', h.created_at,
        'from_stage', (select jsonb_build_object('name_en', fs.name_en, 'name_ar', fs.name_ar)
                       from public.tas_pipeline_stage fs where fs.id = h.from_stage_id),
        'to_stage', (select jsonb_build_object('name_en', ts.name_en, 'name_ar', ts.name_ar)
                     from public.tas_pipeline_stage ts where ts.id = h.to_stage_id)
      ) order by h.created_at)
      from public.tas_application_stage_history h where h.application_id = p_id
    ), '[]'::jsonb)
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. Action RPCs — same signatures as the applied versions, but re-assert OUR
--    bodies (dup-check + friendly message, terminal-status handling, audit
--    events) so behavior matches what /tas-review passed. CREATE OR REPLACE is
--    safe (signatures + return types unchanged).
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
-- 5. Drop Lovable's extra RPCs — our frontend reads tas_candidate /
--    tas_application directly (table select + embed), so these are unused.
--    DROP IF EXISTS is safe; nothing else references them.
-- -----------------------------------------------------------------------------
drop function if exists public.list_candidates(text, int, int);
drop function if exists public.applications_for_candidate(uuid);

-- -----------------------------------------------------------------------------
-- 6. Re-assert EXECUTE grants to authenticated (our 120001 intent).
-- -----------------------------------------------------------------------------
grant execute on function public.upsert_candidate(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_application(uuid, uuid, text)                 to authenticated;
grant execute on function public.move_application_stage(uuid, uuid, text)             to authenticated;
grant execute on function public.set_application_status(uuid, text, text)             to authenticated;
grant execute on function public.list_applications(uuid, uuid, text, text, boolean, int, int) to authenticated;
grant execute on function public.application_detail(uuid)                             to authenticated;
grant execute on function public.list_pipeline_stages()                               to authenticated;

-- =============================================================================
-- End of M1.5 corrective realign.
-- =============================================================================
