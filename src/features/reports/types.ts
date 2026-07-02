// Module M2.4 — Reporting & Analytics: types.
export interface StageCount {
  stage_id: string;
  name_en: string;
  name_ar: string;
  count: number;
}

export interface RecruitmentKpis {
  open_requisitions: number;
  active_applications: number;
  offers_pending: number;
  hires: number;
  by_stage: StageCount[];
  offers_by_status: { status: string; count: number }[];
  applications_by_source: { source: string; count: number }[];
}
