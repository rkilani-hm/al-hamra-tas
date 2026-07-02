// Module M1.1 — Manpower Planning & Headcount: types.
export type ManpowerStatus = "draft" | "active" | "closed";

export interface ManpowerPlanRow {
  id: string;
  fiscal_year: number;
  entity_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
  budgeted_headcount: number;
  kuwaitization_target_pct: number | null;
  status: ManpowerStatus;
  open_requisitions: number;
}

export interface ManpowerPlanInput {
  id: string | null;
  fiscal_year: number;
  entity_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
  budgeted_headcount: number;
  kuwaitization_target_pct: number | null;
  notes: string | null;
}
