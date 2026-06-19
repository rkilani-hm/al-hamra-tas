// Module M1.6 — Screening & Shortlisting: TypeScript types.
// Mirrors supabase/migrations/20260619140000_m1_6_screening.sql + RPC shapes.

export type ScreeningRecommendation = "shortlist" | "reject" | "hold";
export type ScreeningStatus = "draft" | "submitted";
export type ScorecardStatus = "active" | "inactive";

export interface ScreeningCriterion {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  weight: number;
  max_score: number;
  sort_order: number;
}

export interface ScreeningScorecard {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  status: ScorecardStatus;
  criteria: ScreeningCriterion[];
}

// One criterion within a screening record (criterion meta + the recorded score).
export interface ScreeningDetailCriterion {
  criterion_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  weight: number;
  max_score: number;
  sort_order: number;
  score: number | null;
  note: string | null;
}

// screening_detail() record shape.
export interface ScreeningRecord {
  id: string;
  application_id: string;
  scorecard_id: string | null;
  scorecard_name_en: string | null;
  scorecard_name_ar: string | null;
  overall_score: number | null;
  recommendation: ScreeningRecommendation | null;
  notes_en: string | null;
  status: ScreeningStatus;
  screened_by: string | null;
  screened_by_name_en: string | null;
  screened_by_name_ar: string | null;
  screened_at: string;
  created_at: string;
  criteria: ScreeningDetailCriterion[];
}

// Input row for save_screening_scores.
export interface ScreeningScoreInput {
  criterion_id: string;
  score: number | null;
  note?: string | null;
}

// submit_screening() return shape.
export interface SubmitScreeningResult {
  screening_id: string;
  recommendation: ScreeningRecommendation;
  application_id: string;
  moved: boolean;
  message: string;
}
