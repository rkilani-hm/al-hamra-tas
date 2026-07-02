-- =============================================================================
-- Al Hamra TAS — M1.1 fix: upsert_manpower_plan param defaults
-- =============================================================================
-- Defect: p_id (and the other non-default params) had NO default, so a "new plan"
-- call from the client omits p_id -> PostgREST can't resolve the function
-- (PGRST202) and the UI shows "Action failed". Add defaults to every param so the
-- function resolves whether or not the optional args are provided. Signature
-- (param types) unchanged -> existing EXECUTE grant still applies. Body unchanged
-- (still validates fiscal_year). Idempotent CREATE OR REPLACE.
-- =============================================================================

create or replace function public.upsert_manpower_plan(
  p_id uuid default null,
  p_fiscal_year int default null,
  p_entity_id uuid default null,
  p_department_id uuid default null,
  p_job_position_id uuid default null,
  p_budgeted int default 0,
  p_kuwait_pct numeric default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_id uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('manpower.manage') then raise exception 'not_authorized'; end if;
  if p_fiscal_year is null then raise exception 'fiscal_year required'; end if;

  if p_id is null then
    insert into public.tas_manpower_plan
      (fiscal_year, entity_id, department_id, job_position_id, budgeted_headcount, kuwaitization_target_pct, notes, created_by)
    values
      (p_fiscal_year, p_entity_id, p_department_id, p_job_position_id, coalesce(p_budgeted,0), p_kuwait_pct, p_notes, v_caller)
    returning id into v_id;
  else
    update public.tas_manpower_plan
      set fiscal_year = p_fiscal_year, entity_id = p_entity_id, department_id = p_department_id,
          job_position_id = p_job_position_id, budgeted_headcount = coalesce(p_budgeted,0),
          kuwaitization_target_pct = p_kuwait_pct, notes = p_notes, updated_by = v_caller
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'plan % not found', p_id; end if;
  end if;

  perform public.audit_log(v_caller, 'M1.1', 'manpower.upserted', 'manpower_plan', v_id::text,
    jsonb_build_object('fiscal_year', p_fiscal_year, 'budgeted', p_budgeted));
  return v_id;
end; $$;

grant execute on function public.upsert_manpower_plan(uuid, int, uuid, uuid, uuid, int, numeric, text) to authenticated;

-- =============================================================================
-- End of M1.1 fix.
-- =============================================================================
