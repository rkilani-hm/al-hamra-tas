-- =============================================================================
-- Al Hamra TAS — Module M0.2 (follow-up): authenticated READ RLS for config tables
-- =============================================================================
-- Loosens the M0.2 RLS scaffold for CONFIGURATION / MASTER-DATA tables only:
-- authenticated users may now SELECT (read) these reference tables so the config
-- UIs (OrgTree, JobCatalog, JD editor, LookupManager) and the identity
-- ScopeDrawer cascade can display real data.
--
-- WRITES (insert/update/delete) intentionally remain service-role-only — no
-- write policies are added here. Per-role write access is introduced in M3.1.
--
-- Scope: this file touches ONLY the M0.2 config tables listed below. It does NOT
-- modify RLS on any M0.1 identity/access tables (tas_user, tas_role,
-- tas_permission, tas_role_permission, tas_user_role, tas_user_scope,
-- tas_delegation, tas_session, tas_access_audit) — those keep their M0.1 policies.
--
-- RLS is already ENABLED on these tables (M0.1/M0.2 migrations); we only add
-- SELECT policies here. Policies are dropped-if-exists first for idempotency.
-- =============================================================================

-- tas_entity
drop policy if exists tas_entity_select_authenticated on public.tas_entity;
create policy tas_entity_select_authenticated on public.tas_entity
  for select to authenticated using (true);

-- tas_branch
drop policy if exists tas_branch_select_authenticated on public.tas_branch;
create policy tas_branch_select_authenticated on public.tas_branch
  for select to authenticated using (true);

-- tas_department
drop policy if exists tas_department_select_authenticated on public.tas_department;
create policy tas_department_select_authenticated on public.tas_department
  for select to authenticated using (true);

-- tas_job_family
drop policy if exists tas_job_family_select_authenticated on public.tas_job_family;
create policy tas_job_family_select_authenticated on public.tas_job_family
  for select to authenticated using (true);

-- tas_job_grade
drop policy if exists tas_job_grade_select_authenticated on public.tas_job_grade;
create policy tas_job_grade_select_authenticated on public.tas_job_grade
  for select to authenticated using (true);

-- tas_job_position
drop policy if exists tas_job_position_select_authenticated on public.tas_job_position;
create policy tas_job_position_select_authenticated on public.tas_job_position
  for select to authenticated using (true);

-- tas_jd_template
drop policy if exists tas_jd_template_select_authenticated on public.tas_jd_template;
create policy tas_jd_template_select_authenticated on public.tas_jd_template
  for select to authenticated using (true);

-- tas_jd_section
drop policy if exists tas_jd_section_select_authenticated on public.tas_jd_section;
create policy tas_jd_section_select_authenticated on public.tas_jd_section
  for select to authenticated using (true);

-- tas_competency
drop policy if exists tas_competency_select_authenticated on public.tas_competency;
create policy tas_competency_select_authenticated on public.tas_competency
  for select to authenticated using (true);

-- tas_jd_competency
drop policy if exists tas_jd_competency_select_authenticated on public.tas_jd_competency;
create policy tas_jd_competency_select_authenticated on public.tas_jd_competency
  for select to authenticated using (true);

-- tas_lookup
drop policy if exists tas_lookup_select_authenticated on public.tas_lookup;
create policy tas_lookup_select_authenticated on public.tas_lookup
  for select to authenticated using (true);

-- =============================================================================
-- End — authenticated READ enabled for config tables; writes remain
-- service-role-only until M3.1.
-- =============================================================================
