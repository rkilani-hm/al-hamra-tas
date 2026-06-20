// Module M0.2 — Core Configuration: typed Supabase data-access layer.
//
// Reads use the strict typed `supabase` client (authenticated SELECT is live).
// WRITES now flow through M3.1-step1 SECURITY DEFINER config_* RPCs that assert
// the caller is SYSTEM_ADMIN (so the signed-in admin can edit config now).
//
// INTERIM: the config_* RPCs are NOT yet in the generated Database types. Route
// them through a loosely typed client until Lovable applies the migration and
// regenerates types.ts — then swap `db` back to the strict `supabase` client.
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

// INTERIM: swap to strict client after Lovable applies migration (regen types.ts).
const db = supabase as unknown as SupabaseClient;

// =========================================================================
// Org master data
// =========================================================================

export async function listEntities(): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("tas_entity")
    .select("id, code, name_en, name_ar, status, commercial_reg_no, kuwaitization_target_pct")
    .order("code");
  if (error) throw error;
  return (data ?? []) as Entity[];
}

export async function createEntity(input: Omit<Entity, "id">): Promise<Entity> {
  const { data, error } = await db.rpc("config_upsert_entity", {
    p_code: input.code,
    p_name_en: input.name_en,
    p_name_ar: input.name_ar,
    p_commercial_reg_no: input.commercial_reg_no ?? undefined,
    p_kuwaitization_target_pct: input.kuwaitization_target_pct ?? undefined,
    p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as Entity;
}

export async function updateEntity(id: string, patch: Partial<Omit<Entity, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_entity", {
    p_id: id,
    p_code: patch.code ?? undefined,
    p_name_en: patch.name_en ?? undefined,
    p_name_ar: patch.name_ar ?? undefined,
    p_commercial_reg_no: patch.commercial_reg_no ?? undefined,
    p_kuwaitization_target_pct: patch.kuwaitization_target_pct ?? undefined,
    p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

export async function listBranches(entityId?: string): Promise<Branch[]> {
  let query = supabase
    .from("tas_branch")
    .select("id, entity_id, code, name_en, name_ar, status, address_en, address_ar, paci_area")
    .order("code");
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Branch[];
}

export async function createBranch(input: Omit<Branch, "id">): Promise<Branch> {
  const { data, error } = await db.rpc("config_upsert_branch", {
    p_entity_id: input.entity_id,
    p_code: input.code,
    p_name_en: input.name_en,
    p_name_ar: input.name_ar,
    p_address_en: input.address_en ?? undefined,
    p_address_ar: input.address_ar ?? undefined,
    p_paci_area: input.paci_area ?? undefined,
    p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as Branch;
}

export async function updateBranch(id: string, patch: Partial<Omit<Branch, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_branch", {
    p_id: id,
    p_entity_id: patch.entity_id ?? undefined,
    p_code: patch.code ?? undefined,
    p_name_en: patch.name_en ?? undefined,
    p_name_ar: patch.name_ar ?? undefined,
    p_address_en: patch.address_en ?? undefined,
    p_address_ar: patch.address_ar ?? undefined,
    p_paci_area: patch.paci_area ?? undefined,
    p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

export async function listDepartments(branchId?: string): Promise<Department[]> {
  let query = supabase
    .from("tas_department")
    .select("id, branch_id, code, name_en, name_ar, status, parent_department_id, function_code")
    .order("code");
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Department[];
}

export async function createDepartment(input: Omit<Department, "id">): Promise<Department> {
  const { data, error } = await db.rpc("config_upsert_department", {
    p_branch_id: input.branch_id,
    p_code: input.code,
    p_name_en: input.name_en,
    p_name_ar: input.name_ar,
    p_parent_department_id: input.parent_department_id ?? undefined,
    p_function_code: input.function_code ?? undefined,
    p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as Department;
}

export async function updateDepartment(id: string, patch: Partial<Omit<Department, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_department", {
    p_id: id,
    p_branch_id: patch.branch_id ?? undefined,
    p_code: patch.code ?? undefined,
    p_name_en: patch.name_en ?? undefined,
    p_name_ar: patch.name_ar ?? undefined,
    p_parent_department_id: patch.parent_department_id ?? undefined,
    p_function_code: patch.function_code ?? undefined,
    p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

// =========================================================================
// Job catalog
// =========================================================================

export async function listJobFamilies(): Promise<JobFamily[]> {
  const { data, error } = await supabase
    .from("tas_job_family")
    .select("id, code, name_en, name_ar, status")
    .order("code");
  if (error) throw error;
  return (data ?? []) as JobFamily[];
}

export async function createJobFamily(input: Omit<JobFamily, "id">): Promise<JobFamily> {
  const { data, error } = await db.rpc("config_upsert_job_family", {
    p_code: input.code, p_name_en: input.name_en, p_name_ar: input.name_ar, p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as JobFamily;
}

export async function updateJobFamily(id: string, patch: Partial<Omit<JobFamily, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_job_family", {
    p_id: id, p_code: patch.code ?? undefined, p_name_en: patch.name_en ?? undefined,
    p_name_ar: patch.name_ar ?? undefined, p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

export async function listJobGrades(): Promise<JobGrade[]> {
  const { data, error } = await supabase
    .from("tas_job_grade")
    .select("id, code, name_en, name_ar, rank, status")
    .order("rank");
  if (error) throw error;
  return (data ?? []) as JobGrade[];
}

export async function createJobGrade(input: Omit<JobGrade, "id">): Promise<JobGrade> {
  const { data, error } = await db.rpc("config_upsert_job_grade", {
    p_code: input.code, p_name_en: input.name_en, p_name_ar: input.name_ar,
    p_rank: input.rank ?? undefined, p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as JobGrade;
}

export async function updateJobGrade(id: string, patch: Partial<Omit<JobGrade, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_job_grade", {
    p_id: id, p_code: patch.code ?? undefined, p_name_en: patch.name_en ?? undefined,
    p_name_ar: patch.name_ar ?? undefined, p_rank: patch.rank ?? undefined, p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

export async function listJobPositions(): Promise<JobPosition[]> {
  const { data, error } = await supabase
    .from("tas_job_position")
    .select("id, code, name_en, name_ar, job_family_id, job_grade_id, status, is_kuwaitization_targeted")
    .order("code");
  if (error) throw error;
  return (data ?? []) as JobPosition[];
}

export async function createJobPosition(input: Omit<JobPosition, "id">): Promise<JobPosition> {
  const { data, error } = await db.rpc("config_upsert_job_position", {
    p_code: input.code, p_name_en: input.name_en, p_name_ar: input.name_ar,
    p_job_family_id: input.job_family_id ?? undefined, p_job_grade_id: input.job_grade_id ?? undefined,
    p_is_kuwaitization_targeted: input.is_kuwaitization_targeted ?? undefined, p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as JobPosition;
}

export async function updateJobPosition(id: string, patch: Partial<Omit<JobPosition, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_job_position", {
    p_id: id, p_code: patch.code ?? undefined, p_name_en: patch.name_en ?? undefined,
    p_name_ar: patch.name_ar ?? undefined, p_job_family_id: patch.job_family_id ?? undefined,
    p_job_grade_id: patch.job_grade_id ?? undefined,
    p_is_kuwaitization_targeted: patch.is_kuwaitization_targeted ?? undefined, p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

// =========================================================================
// JD / competency templates
// =========================================================================

export async function listJdTemplates(): Promise<JdTemplate[]> {
  const { data, error } = await supabase
    .from("tas_jd_template")
    .select("id, code, job_position_id, title_en, title_ar, summary_en, summary_ar, status, version")
    .order("code");
  if (error) throw error;
  return (data ?? []) as JdTemplate[];
}

export async function getJdTemplate(id: string): Promise<JdTemplateDetail | null> {
  const { data: tpl, error: tplErr } = await supabase
    .from("tas_jd_template")
    .select("id, code, job_position_id, title_en, title_ar, summary_en, summary_ar, status, version")
    .eq("id", id)
    .maybeSingle();
  if (tplErr) throw tplErr;
  if (!tpl) return null;

  const { data: sections, error: secErr } = await supabase
    .from("tas_jd_section")
    .select("id, jd_template_id, section_type, heading_en, heading_ar, body_en, body_ar, sort_order")
    .eq("jd_template_id", id)
    .order("sort_order");
  if (secErr) throw secErr;

  const { data: comps, error: compErr } = await supabase
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

export async function createJdTemplate(input: Omit<JdTemplate, "id">): Promise<JdTemplate> {
  const { data, error } = await db.rpc("config_upsert_jd_template", {
    p_code: input.code, p_job_position_id: input.job_position_id ?? undefined,
    p_title_en: input.title_en, p_title_ar: input.title_ar,
    p_summary_en: input.summary_en ?? undefined, p_summary_ar: input.summary_ar ?? undefined,
    p_status: input.status ?? undefined, p_version: input.version ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as JdTemplate;
}

export async function updateJdTemplate(id: string, patch: Partial<Omit<JdTemplate, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_jd_template", {
    p_id: id, p_code: patch.code ?? undefined, p_job_position_id: patch.job_position_id ?? undefined,
    p_title_en: patch.title_en ?? undefined, p_title_ar: patch.title_ar ?? undefined,
    p_summary_en: patch.summary_en ?? undefined, p_summary_ar: patch.summary_ar ?? undefined,
    p_status: patch.status ?? undefined, p_version: patch.version ?? undefined,
  });
  if (error) throw error;
}

// Replace the full ordered section set for a template.
export async function saveJdSections(
  jdTemplateId: string,
  sections: Omit<JdSection, "id" | "jd_template_id">[],
): Promise<void> {
  const { error } = await db.rpc("config_save_jd_sections", {
    p_jd_template_id: jdTemplateId,
    p_sections: sections as unknown as object,
  });
  if (error) throw error;
}

export async function listCompetencies(): Promise<Competency[]> {
  const { data, error } = await supabase
    .from("tas_competency")
    .select("id, code, name_en, name_ar, category, description_en, description_ar, status")
    .order("code");
  if (error) throw error;
  return (data ?? []) as Competency[];
}

export async function attachCompetency(
  jdTemplateId: string,
  competencyId: string,
  proficiencyLevel: number | null,
): Promise<void> {
  const { error } = await db.rpc("config_attach_competency", {
    p_jd_template_id: jdTemplateId,
    p_competency_id: competencyId,
    p_proficiency_level: proficiencyLevel ?? undefined,
  });
  if (error) throw error;
}

export async function detachCompetency(jdTemplateId: string, competencyId: string): Promise<void> {
  const { error } = await db.rpc("config_detach_competency", {
    p_jd_template_id: jdTemplateId,
    p_competency_id: competencyId,
  });
  if (error) throw error;
}

// =========================================================================
// Generic lookups (keyed by lookup_type)
// =========================================================================

export async function listLookups(lookupType: string): Promise<Lookup[]> {
  const { data, error } = await supabase
    .from("tas_lookup")
    .select("id, lookup_type, code, name_en, name_ar, sort_order, status")
    .eq("lookup_type", lookupType)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Lookup[];
}

export async function createLookup(input: Omit<Lookup, "id">): Promise<Lookup> {
  const { data, error } = await db.rpc("config_upsert_lookup", {
    p_lookup_type: input.lookup_type, p_code: input.code, p_name_en: input.name_en, p_name_ar: input.name_ar,
    p_sort_order: input.sort_order ?? undefined, p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return { ...input, id: data as unknown as string } as Lookup;
}

export async function updateLookup(id: string, patch: Partial<Omit<Lookup, "id">>): Promise<void> {
  const { error } = await db.rpc("config_upsert_lookup", {
    p_id: id, p_lookup_type: patch.lookup_type ?? undefined, p_code: patch.code ?? undefined,
    p_name_en: patch.name_en ?? undefined, p_name_ar: patch.name_ar ?? undefined,
    p_sort_order: patch.sort_order ?? undefined, p_status: patch.status ?? undefined,
  });
  if (error) throw error;
}

export async function deleteLookup(id: string): Promise<void> {
  const { error } = await db.rpc("config_delete_lookup", { p_id: id });
  if (error) throw error;
}

// =========================================================================
// Shared helper: defensively degrade a read to an empty list on error.
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
