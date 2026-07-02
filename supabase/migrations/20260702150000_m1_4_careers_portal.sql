-- =============================================================================
-- Al Hamra TAS — Module M1.4: Careers Portal (public)
-- =============================================================================
-- Public bilingual careers portal: browse published jobs + submit applications
-- without signing in. Public access is via SECURITY DEFINER RPCs granted to anon,
-- scoped to published requisitions / portal intake only. No new table, no new key.
-- Public applications land in M1.5 (source='portal'). No storage bucket SQL.
-- No recursive CTEs.
-- =============================================================================

-- list_public_jobs — published requisitions only.
create or replace function public.list_public_jobs()
returns table(
  id uuid, reference text, title_en text, title_ar text,
  employment_type text, department_en text, department_ar text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.reference, r.title_en, r.title_ar, r.employment_type,
         d.name_en, d.name_ar, r.created_at
  from public.tas_requisition r
  left join public.tas_department d on d.id = r.department_id
  where r.status = 'published'
  order by r.created_at desc
  limit 200;
$$;

-- public_job_detail — a single published job + JD snapshot summary.
create or replace function public.public_job_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'job', (
      select jsonb_build_object('id', r.id, 'reference', r.reference, 'title_en', r.title_en,
                                'title_ar', r.title_ar, 'employment_type', r.employment_type,
                                'contract_type', r.contract_type)
      from public.tas_requisition r where r.id = p_id and r.status = 'published'
    ),
    'department', (
      select jsonb_build_object('name_en', d.name_en, 'name_ar', d.name_ar)
      from public.tas_department d
      join public.tas_requisition r on r.department_id = d.id
      where r.id = p_id and r.status = 'published'
    ),
    'jd', (
      select jsonb_build_object('summary_en', r.jd_snapshot_json->>'summary_en',
                                'summary_ar', r.jd_snapshot_json->>'summary_ar')
      from public.tas_requisition r where r.id = p_id and r.status = 'published'
    )
  );
$$;

-- submit_public_application — public intake -> M1.5 candidate + application (portal).
create or replace function public.submit_public_application(
  p_job_id      uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text default null,
  p_nationality text default null,
  p_cover       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub   boolean;
  v_cand  uuid;
  v_stage uuid;
  v_app   uuid;
  v_ref   text;
begin
  if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'name_required'; end if;
  if nullif(trim(coalesce(p_email,'')),'') is null then raise exception 'email_required'; end if;

  select (status = 'published') into v_pub from public.tas_requisition where id = p_job_id;
  if not coalesce(v_pub, false) then raise exception 'job_not_published'; end if;

  -- Upsert candidate by email (partial unique where email is not null; rubric 12).
  insert into public.tas_candidate (full_name_en, email, phone, nationality, source)
  values (trim(p_full_name), nullif(trim(p_email),'')::citext, p_phone, p_nationality, 'portal')
  on conflict (email) where email is not null do update
    set full_name_en = coalesce(excluded.full_name_en, public.tas_candidate.full_name_en),
        phone        = coalesce(excluded.phone, public.tas_candidate.phone),
        nationality  = coalesce(excluded.nationality, public.tas_candidate.nationality)
  returning id into v_cand;

  -- Dedup active application for this job+candidate.
  if exists (
    select 1 from public.tas_application
    where requisition_id = p_job_id and candidate_id = v_cand and status = 'active'
  ) then
    select reference into v_ref from public.tas_application
    where requisition_id = p_job_id and candidate_id = v_cand and status = 'active' limit 1;
    return jsonb_build_object('application_id', null, 'reference', v_ref, 'duplicate', true);
  end if;

  select id into v_stage from public.tas_pipeline_stage where status = 'active' order by sort_order limit 1;

  insert into public.tas_application (requisition_id, candidate_id, current_stage_id, status, source)
  values (p_job_id, v_cand, v_stage, 'active', 'portal')
  returning id, reference into v_app, v_ref;

  insert into public.tas_application_stage_history (application_id, from_stage_id, to_stage_id, note)
  values (v_app, null, v_stage, 'portal application');

  perform public.audit_log(null, 'M1.4', 'portal.application', 'application', v_app::text,
    jsonb_build_object('job_id', p_job_id, 'email', p_email));

  return jsonb_build_object('application_id', v_app, 'reference', v_ref, 'duplicate', false);
end;
$$;

-- Public surface: grant to anon (unauthenticated portal) + authenticated.
grant execute on function public.list_public_jobs()                                     to anon, authenticated;
grant execute on function public.public_job_detail(uuid)                                to anon, authenticated;
grant execute on function public.submit_public_application(uuid, text, text, text, text, text) to anon, authenticated;

-- =============================================================================
-- End of M1.4 — Careers Portal (public).
-- =============================================================================
