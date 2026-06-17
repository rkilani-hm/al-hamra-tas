// Module M0.2 — Core Configuration: typed Supabase data-access layer.
//
// Uses the strict typed `supabase` client (Database types include the tas_*
// tables after the M0.1/M0.2 migrations were applied on sync). Under the M0.2
// RLS scaffold, config tables are service-role-only until M3.1, so authenticated
// reads return empty — callers wrap these with a degrade-to-empty helper.

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  Branch,
  Competency,
  Department,
  Entity,
  JdSection,
  JdTemplate,
  JdTemplateDetail,
  JobFamily,
  JobGrade,
  JobPosition,
  Lookup,
} from "./types";

// INTERIM (same pattern as M0.1): the generated Database type does not yet
// include the M0.2 tables/columns because Lovable applies this module's
// migration on sync AFTER this code is committed. Until types.ts is
// regenerated, access PostgREST through a loosely-typed view of the client.
// Follow-up: swap `db` back to the strict typed `supabase` client (and delete
// this alias) after the M0.2 migration is applied — mirrors the M0.1 cleanup.
const db = supabase as unknown as SupabaseClient;

// =========================================================================
// Org master data
// =========================================================================

export async function listEntities(): Promise<Entity[]> {
  const { data, error } = await db
    .from("tas_entity")
    .select(
      "id, code, name_en, name_ar, status, commercial_reg_no, kuwaitization_target_pct",
    )
    .order("code");
  if (error) throw error;
  return (data ?? []) as Entity[];
}

export async function createEntity(input: Omit<Entity, "id">): Promise<Entity> {
  const { data, error } = await db
    .from("tas_entity")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function updateEntity(
  id: string,
  patch: Partial<Omit<Entity, "id">>,
): Promise<void> {
  const { error } = await db.from("tas_entity").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listBranches(entityId?: string): Promise<Branch[]> {
  let query = db
    .from("tas_branch")
    .select(
      "id, entity_id, code, name_en, name_ar, status, address_en, address_ar, paci_area",
    )
    .order("code");
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Branch[];
}

export async function createBranch(input: Omit<Branch, "id">): Promise<Branch> {
  const { data, error } = await db
    .from("tas_branch")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Branch;
}

export async function updateBranch(
  id: string,
  patch: Partial<Omit<Branch, "id">>,
): Promise<void> {
  const { error } = await db.from("tas_branch").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listDepartments(branchId?: string): Promise<Department[]> {
  let query = db
    .from("tas_department")
    .select(
      "id, branch_id, code, name_en, name_ar, status, parent_department_id, function_code",
    )
    .order("code");
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Department[];
}

export async function createDepartment(
  input: Omit<Department, "id">,
): Promise<Department> {
  const { data, error } = await db
    .from("tas_department")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Department;
}

export async function updateDepartment(
  id: string,
  patch: Partial<Omit<Department, "id">>,
): Promise<void> {
  const { error } = await db
    .from("tas_department")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

// =========================================================================
// Job catalog
// =========================================================================

export async function listJobFamilies(): Promise<JobFamily[]> {
  const { data, error } = await db
    .from("tas_job_family")
    .select("id, code, name_en, name_ar, status")
    .order("code");
  if (error) throw error;
  return (data ?? []) as JobFamily[];
}

export async function createJobFamily(
  input: Omit<JobFamily, "id">,
): Promise<JobFamily> {
  const { data, error } = await db
    .from("tas_job_family")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as JobFamily;
}

export async function updateJobFamily(
  id: string,
  patch: Partial<Omit<JobFamily, "id">>,
): Promise<void> {
  const { error } = await db
    .from("tas_job_family")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function listJobGrades(): Promise<JobGrade[]> {
  const { data, error } = await db
    .from("tas_job_grade")
    .select("id, code, name_en, name_ar, rank, status")
    .order("rank");
  if (error) throw error;
  return (data ?? []) as JobGrade[];
}

export async function createJobGrade(
  input: Omit<JobGrade, "id">,
): Promise<JobGrade> {
  const { data, error } = await db
    .from("tas_job_grade")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as JobGrade;
}

export async function updateJobGrade(
  id: string,
  patch: Partial<Omit<JobGrade, "id">>,
): Promise<void> {
  const { error } = await db
    .from("tas_job_grade")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function listJobPositions(): Promise<JobPosition[]> {
  const { data, error } = await db
    .from("tas_job_position")
    .select(
      "id, code, name_en, name_ar, job_family_id, job_grade_id, status, is_kuwaitization_targeted",
    )
    .order("code");
  if (error) throw error;
  return (data ?? []) as JobPosition[];
}

export async function createJobPosition(
  input: Omit<JobPosition, "id">,
): Promise<JobPosition> {
  const { data, error } = await db
    .from("tas_job_position")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as JobPosition;
}

export async function updateJobPosition(
  id: string,
  patch: Partial<Omit<JobPosition, "id">>,
): Promise<void> {
  const { error } = await db
    .from("tas_job_position")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

// =========================================================================
// JD / competency templates
// =========================================================================

export async function listJdTemplates(): Promise<JdTemplate[]> {
  const { data, error } = await db
    .from("tas_jd_template")
    .select(
      "id, code, job_position_id, title_en, title_ar, summary_en, summary_ar, status, version",
    )
    .order("code");
  if (error) throw error;
  return (data ?? []) as JdTemplate[];
}

export async function getJdTemplate(
  id: string,
): Promise<JdTemplateDetail | null> {
  const { data: tpl, error: tplErr } = await db
    .from("tas_jd_template")
    .select(
      "id, code, job_position_id, title_en, title_ar, summary_en, summary_ar, status, version",
    )
    .eq("id", id)
    .maybeSingle();
  if (tplErr) throw tplErr;
  if (!tpl) return null;

  const { data: sections, error: secErr } = await db
    .from("tas_jd_section")
    .select(
      "id, jd_template_id, section_type, heading_en, heading_ar, body_en, body_ar, sort_order",
    )
    .eq("jd_template_id", id)
    .order("sort_order");
  if (secErr) throw secErr;

  const { data: comps, error: compErr } = await db
    .from("tas_jd_competency")
    .select(
      "jd_template_id, competency_id, proficiency_level, tas_competency(id, code, name_en, name_ar, category, description_en, description_ar, status)",
    )
    .eq("jd_template_id", id);
  if (compErr) throw compErr;

  return {
    ...(tpl as JdTemplate),
    sections: (sections ?? []) as JdSection[],
    // deno-lint-ignore no-explicit-any
    competencies: ((comps ?? []) as any[]).map((row) => ({
      jd_template_id: row.jd_template_id,
      competency_id: row.competency_id,
      proficiency_level: row.proficiency_level,
      competency: row.tas_competency as Competency,
    })),
  };
}

export async function createJdTemplate(
  input: Omit<JdTemplate, "id">,
): Promise<JdTemplate> {
  const { data, error } = await db
    .from("tas_jd_template")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as JdTemplate;
}

export async function updateJdTemplate(
  id: string,
  patch: Partial<Omit<JdTemplate, "id">>,
): Promise<void> {
  const { error } = await db
    .from("tas_jd_template")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

// Replace the full ordered section set for a template.
export async function saveJdSections(
  jdTemplateId: string,
  sections: Omit<JdSection, "id" | "jd_template_id">[],
): Promise<void> {
  const { error: delErr } = await db
    .from("tas_jd_section")
    .delete()
    .eq("jd_template_id", jdTemplateId);
  if (delErr) throw delErr;

  if (sections.length === 0) return;
  const rows = sections.map((s) => ({ ...s, jd_template_id: jdTemplateId }));
  const { error: insErr } = await db.from("tas_jd_section").insert(rows);
  if (insErr) throw insErr;
}

export async function listCompetencies(): Promise<Competency[]> {
  const { data, error } = await db
    .from("tas_competency")
    .select(
      "id, code, name_en, name_ar, category, description_en, description_ar, status",
    )
    .order("code");
  if (error) throw error;
  return (data ?? []) as Competency[];
}

export async function attachCompetency(
  jdTemplateId: string,
  competencyId: string,
  proficiencyLevel: number | null,
): Promise<void> {
  const { error } = await db.from("tas_jd_competency").upsert({
    jd_template_id: jdTemplateId,
    competency_id: competencyId,
    proficiency_level: proficiencyLevel,
  });
  if (error) throw error;
}

export async function detachCompetency(
  jdTemplateId: string,
  competencyId: string,
): Promise<void> {
  const { error } = await db
    .from("tas_jd_competency")
    .delete()
    .eq("jd_template_id", jdTemplateId)
    .eq("competency_id", competencyId);
  if (error) throw error;
}

// =========================================================================
// Generic lookups (keyed by lookup_type)
// =========================================================================

export async function listLookups(lookupType: string): Promise<Lookup[]> {
  const { data, error } = await db
    .from("tas_lookup")
    .select("id, lookup_type, code, name_en, name_ar, sort_order, status")
    .eq("lookup_type", lookupType)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Lookup[];
}

export async function createLookup(input: Omit<Lookup, "id">): Promise<Lookup> {
  const { data, error } = await db
    .from("tas_lookup")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Lookup;
}

export async function updateLookup(
  id: string,
  patch: Partial<Omit<Lookup, "id">>,
): Promise<void> {
  const { error } = await db.from("tas_lookup").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLookup(id: string): Promise<void> {
  const { error } = await db.from("tas_lookup").delete().eq("id", id);
  if (error) throw error;
}

// =========================================================================
// Shared helper: degrade reads to empty under the M0.2 RLS scaffold.
// =========================================================================

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[config] query failed (showing empty):", err);
      return [];
    }
  };
}
