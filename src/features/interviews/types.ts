// Module M1.7 — Interview Management: TypeScript types.
// Mirrors supabase/migrations/20260619150000_m1_7_interviews.sql + RPC shapes.

export type InterviewMode = "onsite" | "teams" | "phone";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type CalendarStatus = "none" | "skipped" | "created" | "failed";
export type InterviewOutcome = "proceed" | "reject" | "hold";
export type InterviewRecommendation = "proceed" | "reject" | "hold";

// tas_lookup row (lookup_type='interview_round').
export interface RoundType {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
}

// list_interviews() row.
export interface InterviewListRow {
  id: string;
  reference: string | null;
  application_id: string;
  application_ref: string | null;
  candidate_name_en: string | null;
  candidate_name_ar: string | null;
  round_type: string | null;
  scheduled_at: string | null;
  duration_min: number;
  mode: InterviewMode;
  location: string | null;
  status: InterviewStatus;
  calendar_status: CalendarStatus;
  outcome: InterviewOutcome | null;
  teams_join_url: string | null;
}

export interface InterviewRecord {
  id: string;
  reference: string | null;
  application_id: string;
  round_type: string | null;
  scheduled_at: string | null;
  duration_min: number;
  mode: InterviewMode;
  location: string | null;
  status: InterviewStatus;
  calendar_status: CalendarStatus;
  outlook_event_id: string | null;
  teams_join_url: string | null;
  outcome: InterviewOutcome | null;
  scorecard_id: string | null;
  scheduled_by: string | null;
  created_at: string;
}

export interface InterviewPanelist {
  id: string;
  user_id: string;
  role: string | null;
  name_en: string | null;
  name_ar: string | null;
  email: string | null;
}

export interface InterviewScoreDetail {
  criterion_id: string;
  score: number | null;
  note: string | null;
}

export interface InterviewScore {
  id: string;
  panelist_user_id: string | null;
  panelist_name_en: string | null;
  panelist_name_ar: string | null;
  overall_score: number | null;
  recommendation: InterviewRecommendation | null;
  notes_en: string | null;
  submitted_at: string | null;
  details: InterviewScoreDetail[];
}

export interface InterviewCriterion {
  criterion_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  weight: number;
  max_score: number;
  sort_order: number;
}

// interview_detail() jsonb shape.
export interface InterviewDetailData {
  interview: InterviewRecord | null;
  application: {
    id: string;
    reference: string | null;
    status: string;
    current_stage_id: string | null;
  } | null;
  candidate: {
    id: string;
    full_name_en: string | null;
    full_name_ar: string | null;
    email: string | null;
  } | null;
  panelists: InterviewPanelist[];
  scores: InterviewScore[];
  criteria: InterviewCriterion[];
}

// interview_panel_summary() jsonb shape.
export interface PanelSummary {
  interview_id: string;
  panel_average: number | null;
  panelist_count: number;
  panelists: {
    panelist_user_id: string | null;
    name_en: string | null;
    name_ar: string | null;
    overall_score: number | null;
    recommendation: InterviewRecommendation | null;
    submitted_at: string | null;
  }[];
}

export interface ScheduleInterviewInput {
  applicationId: string;
  roundType?: string | null;
  scheduledAt?: string | null;
  durationMin?: number | null;
  mode: InterviewMode;
  location?: string | null;
  panelistIds: string[];
  scorecardId?: string | null;
}

export interface InterviewScoreInput {
  criterion_id: string;
  score: number | null;
  note?: string | null;
}

export interface InterviewListFilter {
  applicationId?: string | null;
  status?: string | null;
  mine?: boolean;
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}
