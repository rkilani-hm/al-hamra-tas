// Module M1.5 — Application Tracking (ATS): TypeScript types.
// Mirrors supabase/migrations/20260619120000_m1_5_applications.sql + RPC shapes.

export type CandidateStatus = "active" | "archived" | "blacklisted";
export type ApplicationStatus = "active" | "hired" | "rejected" | "withdrawn" | "on_hold";
export type StageType = "open" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";

export interface Candidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name_en: string | null;
  full_name_ar: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  nationality_class: string | null;
  current_title: string | null;
  source: string | null;
  status: CandidateStatus;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  stage_type: StageType;
  is_terminal: boolean;
  status: "active" | "inactive";
}

// list_applications() enriched row.
export interface ApplicationListRow {
  id: string;
  reference: string | null;
  requisition_id: string;
  requisition_reference: string | null;
  candidate_id: string;
  candidate_name_en: string | null;
  candidate_name_ar: string | null;
  current_stage_id: string | null;
  stage_name_en: string | null;
  stage_name_ar: string | null;
  stage_type: StageType | null;
  status: ApplicationStatus;
  owner_user_id: string | null;
  applied_at: string;
  created_at: string;
}

export interface ApplicationRecord {
  id: string;
  reference: string | null;
  requisition_id: string;
  candidate_id: string;
  current_stage_id: string | null;
  status: ApplicationStatus;
  applied_at: string;
  source: string | null;
  owner_user_id: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface StageHistoryEntry {
  id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  note: string | null;
  moved_by: string | null;
  created_at: string;
  from_stage: { name_en: string; name_ar: string } | null;
  to_stage: { name_en: string; name_ar: string } | null;
}

// application_detail() jsonb shape.
export interface ApplicationDetailData {
  application: ApplicationRecord | null;
  candidate: Candidate | null;
  current_stage: PipelineStage | null;
  requisition: {
    id: string;
    reference: string | null;
    title_en: string | null;
    title_ar: string | null;
    status: string;
  } | null;
  history: StageHistoryEntry[];
}

export interface ApplicationFilter {
  requisitionId?: string | null;
  stageId?: string | null;
  status?: string | null;
  candidateSearch?: string | null;
  mine?: boolean;
  limit?: number;
  offset?: number;
}

export interface CandidateInput {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name_en?: string | null;
  full_name_ar?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  nationality_class?: string | null;
  current_title?: string | null;
  source?: string | null;
}
