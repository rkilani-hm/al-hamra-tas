-- =============================================================================
-- Al Hamra TAS — Module M2.7: Candidate Sourcing Phase 1 (Website intake)
-- =============================================================================
-- Production-grade website/careers intake on top of M1.4: capture a CV ref +
-- explicit source, and notify the requisition owner on every new application.
-- Candidate confirmation email + AI CV enrichment are handled by edge functions
-- (careers-postapply). No storage bucket SQL. No recursive CTEs.
-- =============================================================================

-- Candidate enrichment columns (AI parse fills skills/experience; CV ref stored).
alter table public.tas_candidate
  add column if not exists resume_ref       text,
  add column if not exists skills           text[],
  add column if not exists years_experience int;

-- Recruiter notification template (in_app + outlook_email, bilingual).
insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('application.received', 'in_app',
   'New application: {{job}}',
   'طلب جديد: {{job}}',
   'A new application was received for {{job}} from {{candidate}}.',
   'تم استلام طلب جديد لوظيفة {{job}} من {{candidate}}.',
   '["job","candidate"]', 'active', 1),
  ('application.received', 'outlook_email',
   'New application: {{job}}',
   'طلب جديد: {{job}}',
   'A new application was received for {{job}} from {{candidate}}. Open the TAS to review.',
   'تم استلام طلب جديد لوظيفة {{job}} من {{candidate}}. افتح النظام للمراجعة.',
   '["job","candidate"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- Recreate submit_public_application with explicit source + résumé ref. The two
-- new params are appended with defaults so existing 6-arg callers still resolve.
drop function if exists public.submit_public_application(uuid, text, text, text, text, text);

create or replace function public.submit_public_application(
  p_job_id      uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text default null,
  p_nationality text default null,
  p_cover       text default null,
  p_source      text default 'website',
  p_resume_ref  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub    boolean;
  v_cand   uuid;
  v_stage  uuid;
  v_app    uuid;
  v_ref    text;
  v_src    text := coalesce(nullif(trim(p_source), ''), 'website');
  v_owner  uuid;
  v_title  text;
begin
  if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'name_required'; end if;
  if nullif(trim(coalesce(p_email,'')),'') is null then raise exception 'email_required'; end if;

  select (status = 'published'), requested_by, coalesce(title_en, reference)
    into v_pub, v_owner, v_title
    from public.tas_requisition where id = p_job_id;
  if not coalesce(v_pub, false) then raise exception 'job_not_published'; end if;

  -- Upsert candidate by email (partial unique where email is not null; rubric 12).
  insert into public.tas_candidate (full_name_en, email, phone, nationality, source, resume_ref)
  values (trim(p_full_name), nullif(trim(p_email),'')::citext, p_phone, p_nationality, v_src, p_resume_ref)
  on conflict (email) where email is not null do update
    set full_name_en = coalesce(excluded.full_name_en, public.tas_candidate.full_name_en),
        phone        = coalesce(excluded.phone, public.tas_candidate.phone),
        nationality  = coalesce(excluded.nationality, public.tas_candidate.nationality),
        resume_ref   = coalesce(excluded.resume_ref, public.tas_candidate.resume_ref),
        source       = coalesce(public.tas_candidate.source, excluded.source)
  returning id into v_cand;

  -- Dedup active application for this job+candidate.
  if exists (
    select 1 from public.tas_application
    where requisition_id = p_job_id and candidate_id = v_cand and status = 'active'
  ) then
    select reference into v_ref from public.tas_application
    where requisition_id = p_job_id and candidate_id = v_cand and status = 'active' limit 1;
    return jsonb_build_object('application_id', null, 'candidate_id', v_cand, 'reference', v_ref, 'duplicate', true);
  end if;

  select id into v_stage from public.tas_pipeline_stage where status = 'active' order by sort_order limit 1;

  insert into public.tas_application (requisition_id, candidate_id, current_stage_id, status, source)
  values (p_job_id, v_cand, v_stage, 'active', v_src)
  returning id, reference into v_app, v_ref;

  insert into public.tas_application_stage_history (application_id, from_stage_id, to_stage_id, note)
  values (v_app, null, v_stage, v_src || ' application');

  -- Notify the requisition owner (recruiter) — in_app + outlook_email if live.
  if v_owner is not null then
    perform public.notify('application.received', array[v_owner],
      jsonb_build_object('job', coalesce(v_title,''), 'candidate', trim(p_full_name)),
      '/app/applications/' || v_app::text);
  end if;

  perform public.audit_log(null, 'M2.7', 'portal.application', 'application', v_app::text,
    jsonb_build_object('job_id', p_job_id, 'email', p_email, 'source', v_src));

  return jsonb_build_object('application_id', v_app, 'candidate_id', v_cand, 'reference', v_ref, 'duplicate', false);
end;
$$;

grant execute on function public.submit_public_application(uuid, text, text, text, text, text, text, text) to anon, authenticated;

-- =============================================================================
-- End of M2.7 — Website intake (Phase 1).
-- =============================================================================
