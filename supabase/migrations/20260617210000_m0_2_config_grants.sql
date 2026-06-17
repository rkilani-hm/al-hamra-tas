-- =============================================================================
-- Al Hamra TAS — Module M0.2 (follow-up): explicit SELECT grants for config tables
-- =============================================================================
-- Adds explicit table-level SELECT privilege to the `authenticated` role for the
-- 11 M0.2 configuration / master-data tables, to MATCH the authenticated read
-- policies added in the M0.2 read-RLS migration. RLS still governs row access;
-- this just ensures the table-level privilege is present (a SELECT policy without
-- the underlying GRANT would otherwise yield "permission denied").
--
-- WRITES are intentionally NOT granted — insert/update/delete remain
-- service-role-only until per-role write policies arrive in M3.1.
--
-- Scope: ONLY the 11 M0.2 config tables below. Does NOT touch the M0.1
-- identity/access tables. GRANT is idempotent (re-running is a harmless no-op).
-- =============================================================================

grant select on public.tas_entity        to authenticated;
grant select on public.tas_branch        to authenticated;
grant select on public.tas_department     to authenticated;
grant select on public.tas_job_family     to authenticated;
grant select on public.tas_job_grade      to authenticated;
grant select on public.tas_job_position   to authenticated;
grant select on public.tas_jd_template    to authenticated;
grant select on public.tas_jd_section     to authenticated;
grant select on public.tas_competency     to authenticated;
grant select on public.tas_jd_competency  to authenticated;
grant select on public.tas_lookup         to authenticated;

-- =============================================================================
-- End — authenticated SELECT privilege granted for config tables; writes remain
-- service-role-only until M3.1.
-- =============================================================================
