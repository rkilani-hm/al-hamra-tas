// Module M1.2 — Job Requisition: TypeScript types.
// Mirrors supabase/migrations/20260619100000_m1_2_requisition.sql + RPC shapes.

export type RequisitionStatus =
  | "draft"
  | "submitted"
  | "in_approval"
  | "approved"
  | "published"
  | "on_hold"
  | "cancelled"
  | "closed";

export type RequisitionAction = "publish" | "hold" | "cancel" | "close";

// Full requisition record (the tas_requisition row).
export interface RequisitionRecord {
  id: string;
  reference: string | null;
  title_en: string | null;
  title_ar: string | null;
  job_position_id: string;
  jd_template_id: string | null;
  jd_snapshot_json: Record<string, unknown>;
  entity_id: string;
  branch_id: string | null;
  department_id: string | null;
  headcount: number;
  employment_type: string | null;
  contract_type: string | null;
  target_start_date: string | null;
  salary_min: number | null;
  salary_max: number | null;
  budgeted_position_id: string | null;
  justification_en: string | null;
  status: RequisitionStatus;
  workflow_instance_id: string | null;
  requested_by: string | null;
  created_at: string;
}

// list_requisitions() row.
export interface RequisitionListRow {
  id: string;
  reference: string | null;
  title_en: string | null;
  title_ar: string | null;
  job_position_id: string;
  department_id: string | null;
  headcount: number;
  status: RequisitionStatus;
  workflow_instance_id: string | null;
  requested_by: string | null;
  created_at: string;
}

export interface RequisitionEvent {
  id: string;
  requisition_id: string;
  event_type: string | null;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  detail_json: Record<string, unknown>;
  created_at: string;
}

// check_budgeted_position() result.
export interface BudgetedCheck {
  budgeted: number;
  filled: number;
  available: number;
  over_budget: boolean;
}

// requisition_detail() jsonb shape.
export interface RequisitionDetailData {
  requisition: RequisitionRecord | null;
  jd_snapshot: Record<string, unknown> | null;
  instance: unknown | null; // instance_timeline jsonb (consumed by <ApprovalTimeline> via id)
  events: RequisitionEvent[];
}

export interface RequisitionFilter {
  status?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  from?: string | null;
  to?: string | null;
  mine?: boolean;
  limit?: number;
  offset?: number;
}

// Draft create payload (authenticated own-draft insert).
export interface RequisitionDraftInput {
  title_en?: string | null;
  title_ar?: string | null;
  job_position_id: string;
  jd_template_id?: string | null;
  jd_snapshot_json?: Record<string, unknown>;
  entity_id: string;
  branch_id?: string | null;
  department_id?: string | null;
  headcount: number;
  employment_type?: string | null;
  contract_type?: string | null;
  target_start_date?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  justification_en?: string | null;
  requested_by: string | null;
}
