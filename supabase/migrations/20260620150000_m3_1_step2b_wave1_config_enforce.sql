-- =============================================================================
-- Al Hamra TAS — M3.1-step2b-wave1: Enforcement flip for Config (config.manage)
-- =============================================================================
-- FIRST enforcement wave. The 15 config-write RPCs from M3.1-step1
-- (20260620130000) currently assert _is_system_admin() (SYSTEM_ADMIN only). This
-- generalizes that single gate line to the data-driven permission check:
--     if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
-- so any role granted config.manage (SYSTEM_ADMIN via bypass, HR_MANAGER via the
-- seeded grant) can manage config, while roles without it are denied.
--
-- GATE-SWAP ONLY: each function below is reproduced VERBATIM from 20260620130000 —
-- identical signature, SECURITY DEFINER, search_path, declarations, and body —
-- with ONLY the authorization line changed. No schema, no new RPCs, no seeds.
-- CREATE OR REPLACE (idempotent). No storage bucket SQL. No recursive CTEs. The
-- only ON CONFLICT is tas_jd_competency's PK (jd_template_id, competency_id)
-- [rubric 12], reproduced unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Org structure
-- -----------------------------------------------------------------------------
create or replace function public.config_upsert_entity(
  p_id                      uuid    default null,
  p_code                    text    default null,
  p_name_en                 text    default null,
  p_name_ar                 text    default null,
  p_commercial_reg_no       text    default null,
  p_kuwaitization_target_pct numeric default null,
  p_status                  text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_entity (code, name_en, name_ar, commercial_reg_no, kuwaitization_target_pct, status, created_by)
    values (p_code, p_name_en, p_name_ar, p_commercial_reg_no, p_kuwaitization_target_pct,
            coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_entity set
      code = coalesce(p_code, code), name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      commercial_reg_no = coalesce(p_commercial_reg_no, commercial_reg_no),
      kuwaitization_target_pct = coalesce(p_kuwaitization_target_pct, kuwaitization_target_pct),
      status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.config_upsert_branch(
  p_id         uuid default null,
  p_entity_id  uuid default null,
  p_code       text default null,
  p_name_en    text default null,
  p_name_ar    text default null,
  p_address_en text default null,
  p_address_ar text default null,
  p_paci_area  text default null,
  p_status     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_branch (entity_id, code, name_en, name_ar, address_en, address_ar, paci_area, status, created_by)
    values (p_entity_id, p_code, p_name_en, p_name_ar, p_address_en, p_address_ar, p_paci_area,
            coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_branch set
      entity_id = coalesce(p_entity_id, entity_id), code = coalesce(p_code, code),
      name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      address_en = coalesce(p_address_en, address_en), address_ar = coalesce(p_address_ar, address_ar),
      paci_area = coalesce(p_paci_area, paci_area), status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.config_upsert_department(
  p_id                  uuid default null,
  p_branch_id           uuid default null,
  p_code                text default null,
  p_name_en             text default null,
  p_name_ar             text default null,
  p_parent_department_id uuid default null,
  p_function_code       text default null,
  p_status              text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_department (branch_id, code, name_en, name_ar, parent_department_id, function_code, status, created_by)
    values (p_branch_id, p_code, p_name_en, p_name_ar, p_parent_department_id, p_function_code,
            coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_department set
      branch_id = coalesce(p_branch_id, branch_id), code = coalesce(p_code, code),
      name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      parent_department_id = coalesce(p_parent_department_id, parent_department_id),
      function_code = coalesce(p_function_code, function_code),
      status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Job catalog
-- -----------------------------------------------------------------------------
create or replace function public.config_upsert_job_family(
  p_id uuid default null, p_code text default null, p_name_en text default null,
  p_name_ar text default null, p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_job_family (code, name_en, name_ar, status, created_by)
    values (p_code, p_name_en, p_name_ar, coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_job_family set
      code = coalesce(p_code, code), name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.config_upsert_job_grade(
  p_id uuid default null, p_code text default null, p_name_en text default null,
  p_name_ar text default null, p_rank int default null, p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_job_grade (code, name_en, name_ar, rank, status, created_by)
    values (p_code, p_name_en, p_name_ar, p_rank, coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_job_grade set
      code = coalesce(p_code, code), name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      rank = coalesce(p_rank, rank), status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.config_upsert_job_position(
  p_id uuid default null, p_code text default null, p_name_en text default null, p_name_ar text default null,
  p_job_family_id uuid default null, p_job_grade_id uuid default null,
  p_is_kuwaitization_targeted boolean default null, p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_job_position (code, name_en, name_ar, job_family_id, job_grade_id, is_kuwaitization_targeted, status, created_by)
    values (p_code, p_name_en, p_name_ar, p_job_family_id, p_job_grade_id,
            coalesce(p_is_kuwaitization_targeted, false), coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_job_position set
      code = coalesce(p_code, code), name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      job_family_id = coalesce(p_job_family_id, job_family_id), job_grade_id = coalesce(p_job_grade_id, job_grade_id),
      is_kuwaitization_targeted = coalesce(p_is_kuwaitization_targeted, is_kuwaitization_targeted),
      status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lookups
-- -----------------------------------------------------------------------------
create or replace function public.config_upsert_lookup(
  p_id uuid default null, p_lookup_type text default null, p_code text default null,
  p_name_en text default null, p_name_ar text default null, p_sort_order int default null, p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_lookup (lookup_type, code, name_en, name_ar, sort_order, status, created_by)
    values (p_lookup_type, p_code, p_name_en, p_name_ar, coalesce(p_sort_order, 0),
            coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_lookup set
      lookup_type = coalesce(p_lookup_type, lookup_type), code = coalesce(p_code, code),
      name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      sort_order = coalesce(p_sort_order, sort_order), status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.config_delete_lookup(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  delete from public.tas_lookup where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- JD templates + sections + competencies
-- -----------------------------------------------------------------------------
create or replace function public.config_upsert_jd_template(
  p_id uuid default null, p_code text default null, p_job_position_id uuid default null,
  p_title_en text default null, p_title_ar text default null, p_summary_en text default null,
  p_summary_ar text default null, p_status text default null, p_version int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_jd_template (code, job_position_id, title_en, title_ar, summary_en, summary_ar, status, version, created_by)
    values (p_code, p_job_position_id, p_title_en, p_title_ar, p_summary_en, p_summary_ar,
            coalesce(nullif(p_status,''),'draft'), coalesce(p_version, 1), v_caller)
    returning id into v_id;
  else
    update public.tas_jd_template set
      code = coalesce(p_code, code), job_position_id = coalesce(p_job_position_id, job_position_id),
      title_en = coalesce(p_title_en, title_en), title_ar = coalesce(p_title_ar, title_ar),
      summary_en = coalesce(p_summary_en, summary_en), summary_ar = coalesce(p_summary_ar, summary_ar),
      status = coalesce(nullif(p_status,''), status), version = coalesce(p_version, version), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- Replace the full ordered section set for a template (delete + reinsert).
create or replace function public.config_save_jd_sections(p_jd_template_id uuid, p_sections jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  delete from public.tas_jd_section where jd_template_id = p_jd_template_id;
  insert into public.tas_jd_section (jd_template_id, section_type, heading_en, heading_ar, body_en, body_ar, sort_order)
  select p_jd_template_id, elem->>'section_type', elem->>'heading_en', elem->>'heading_ar',
         elem->>'body_en', elem->>'body_ar', coalesce((elem->>'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) as elem;
end;
$$;

create or replace function public.config_attach_competency(
  p_jd_template_id uuid, p_competency_id uuid, p_proficiency_level int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  -- ON CONFLICT target = tas_jd_competency PK (jd_template_id, competency_id) [rubric 12].
  insert into public.tas_jd_competency (jd_template_id, competency_id, proficiency_level)
  values (p_jd_template_id, p_competency_id, p_proficiency_level)
  on conflict (jd_template_id, competency_id) do update set proficiency_level = excluded.proficiency_level;
end;
$$;

create or replace function public.config_detach_competency(p_jd_template_id uuid, p_competency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  delete from public.tas_jd_competency where jd_template_id = p_jd_template_id and competency_id = p_competency_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pipeline stages (M1.5 StageConfig)
-- -----------------------------------------------------------------------------
create or replace function public.config_upsert_pipeline_stage(
  p_id uuid default null, p_code text default null, p_name_en text default null, p_name_ar text default null,
  p_sort_order int default null, p_stage_type text default null, p_is_terminal boolean default null, p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_pipeline_stage (code, name_en, name_ar, sort_order, stage_type, is_terminal, status, created_by)
    values (p_code, p_name_en, p_name_ar, coalesce(p_sort_order, 0), coalesce(nullif(p_stage_type,''),'open'),
            coalesce(p_is_terminal, false), coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_pipeline_stage set
      code = coalesce(p_code, code), name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      sort_order = coalesce(p_sort_order, sort_order), stage_type = coalesce(nullif(p_stage_type,''), stage_type),
      is_terminal = coalesce(p_is_terminal, is_terminal), status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Screening scorecards + criteria (M1.6 ScorecardConfig)
-- -----------------------------------------------------------------------------
create or replace function public.config_upsert_scorecard(
  p_id uuid default null, p_code text default null, p_name_en text default null, p_name_ar text default null,
  p_description_en text default null, p_description_ar text default null, p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_screening_scorecard (code, name_en, name_ar, description_en, description_ar, status, created_by)
    values (p_code, p_name_en, p_name_ar, p_description_en, p_description_ar, coalesce(nullif(p_status,''),'active'), v_caller)
    returning id into v_id;
  else
    update public.tas_screening_scorecard set
      code = coalesce(p_code, code), name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      description_en = coalesce(p_description_en, description_en), description_ar = coalesce(p_description_ar, description_ar),
      status = coalesce(nullif(p_status,''), status), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.config_upsert_criterion(
  p_id uuid default null, p_scorecard_id uuid default null, p_code text default null,
  p_name_en text default null, p_name_ar text default null, p_weight numeric default null,
  p_max_score int default null, p_sort_order int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_caller uuid; v_id uuid;
begin
  if not public._has_permission('config.manage') then raise exception 'not_authorized'; end if;
  v_caller := public._admin_caller_id();
  if p_id is null then
    insert into public.tas_screening_criterion (scorecard_id, code, name_en, name_ar, weight, max_score, sort_order, created_by)
    values (p_scorecard_id, p_code, p_name_en, p_name_ar, coalesce(p_weight, 1), coalesce(p_max_score, 5),
            coalesce(p_sort_order, 0), v_caller)
    returning id into v_id;
  else
    update public.tas_screening_criterion set
      scorecard_id = coalesce(p_scorecard_id, scorecard_id), code = coalesce(p_code, code),
      name_en = coalesce(p_name_en, name_en), name_ar = coalesce(p_name_ar, name_ar),
      weight = coalesce(p_weight, weight), max_score = coalesce(p_max_score, max_score),
      sort_order = coalesce(p_sort_order, sort_order), updated_by = v_caller
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- =============================================================================
-- GRANTS — re-assert EXECUTE to authenticated (unchanged signatures). The in-RPC
-- _has_permission('config.manage') check is now the gate.
-- =============================================================================
grant execute on function public.config_upsert_entity(uuid, text, text, text, text, numeric, text)        to authenticated;
grant execute on function public.config_upsert_branch(uuid, uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.config_upsert_department(uuid, uuid, text, text, text, uuid, text, text)   to authenticated;
grant execute on function public.config_upsert_job_family(uuid, text, text, text, text)                     to authenticated;
grant execute on function public.config_upsert_job_grade(uuid, text, text, text, int, text)                 to authenticated;
grant execute on function public.config_upsert_job_position(uuid, text, text, text, uuid, uuid, boolean, text) to authenticated;
grant execute on function public.config_upsert_lookup(uuid, text, text, text, text, int, text)              to authenticated;
grant execute on function public.config_delete_lookup(uuid)                                                 to authenticated;
grant execute on function public.config_upsert_jd_template(uuid, text, uuid, text, text, text, text, text, int) to authenticated;
grant execute on function public.config_save_jd_sections(uuid, jsonb)                                       to authenticated;
grant execute on function public.config_attach_competency(uuid, uuid, int)                                  to authenticated;
grant execute on function public.config_detach_competency(uuid, uuid)                                       to authenticated;
grant execute on function public.config_upsert_pipeline_stage(uuid, text, text, text, int, text, boolean, text) to authenticated;
grant execute on function public.config_upsert_scorecard(uuid, text, text, text, text, text, text)          to authenticated;
grant execute on function public.config_upsert_criterion(uuid, uuid, text, text, text, numeric, int, int)   to authenticated;

-- =============================================================================
-- End of M3.1-step2b-wave1 config enforcement flip.
-- =============================================================================
