// Module M0.2 — Core Configuration: TypeScript types mirroring the new/altered
// master-data tables. Aligned with supabase/migrations/20260618090000_m0_2_core_config.sql.
// (For end-to-end PostgREST typing the generated Database type is used in api.ts;
//  these are the view models the UI works with.)

export type RecordStatus = "active" | "inactive";
export type JdStatus = "draft" | "active" | "archived";
export type JdSectionType =
  | "responsibilities"
  | "requirements"
  | "qualifications"
  | "benefits"
  | "other";

// --- Org master data (M0.1 stubs, now extended) ----------------------------
export interface Entity {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  commercial_reg_no: string | null;
  kuwaitization_target_pct: number | null;
}

export interface Branch {
  id: string;
  entity_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  address_en: string | null;
  address_ar: string | null;
  paci_area: string | null;
}

export interface Department {
  id: string;
  branch_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  parent_department_id: string | null;
  function_code: string | null;
}

// --- Job catalog ------------------------------------------------------------
export interface JobFamily {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
}

export interface JobGrade {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  rank: number | null;
  status: string;
}

export interface JobPosition {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  job_family_id: string | null;
  job_grade_id: string | null;
  status: string;
  is_kuwaitization_targeted: boolean;
}

// --- JD / competency templates ---------------------------------------------
export interface JdTemplate {
  id: string;
  code: string;
  job_position_id: string | null;
  title_en: string;
  title_ar: string;
  summary_en: string | null;
  summary_ar: string | null;
  status: JdStatus;
  version: number;
}

export interface JdSection {
  id: string;
  jd_template_id: string;
  section_type: JdSectionType;
  heading_en: string | null;
  heading_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  sort_order: number;
}

export interface Competency {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  category: string | null;
  description_en: string | null;
  description_ar: string | null;
  status: string;
}

export interface JdCompetency {
  jd_template_id: string;
  competency_id: string;
  proficiency_level: number | null;
}

// A JD template with its sections and attached competencies.
export interface JdTemplateDetail extends JdTemplate {
  sections: JdSection[];
  competencies: (JdCompetency & { competency: Competency })[];
}

// --- Generic lookups --------------------------------------------------------
export interface Lookup {
  id: string;
  lookup_type: string;
  code: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  status: string;
}

// Known lookup_type keys (extend as needed; the table itself is open).
export const LOOKUP_TYPES = [
  "employment_type",
  "contract_type",
  "nationality_class",
  "work_location_type",
] as const;
export type LookupType = (typeof LOOKUP_TYPES)[number];
