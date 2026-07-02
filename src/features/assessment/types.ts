// Module M1.8 — Assessment & Evaluation: types.
export type AssessmentType = "technical" | "psychometric" | "case_study" | "other";
export type AssessmentStatus = "draft" | "submitted";
export type AssessmentRecommendation = "proceed" | "hold" | "reject";

export interface AssessmentItem {
  id: string;
  label_en: string | null;
  label_ar: string | null;
  weight: number;
  score: number | null;
  max_score: number;
  note: string | null;
}

export interface AssessmentRecord {
  id: string;
  application_id: string;
  candidate_id: string | null;
  assessment_type: AssessmentType;
  title: string | null;
  status: AssessmentStatus;
  overall_score: number | null;
  recommendation: AssessmentRecommendation | null;
  notes: string | null;
  submitted_at: string | null;
}

export interface AssessmentDetailData {
  assessment: AssessmentRecord | null;
  items: AssessmentItem[];
}

export interface AssessmentListRow {
  id: string;
  application_id: string;
  assessment_type: AssessmentType;
  title: string | null;
  status: AssessmentStatus;
  overall_score: number | null;
  recommendation: AssessmentRecommendation | null;
  created_at: string;
}

export interface AssessmentItemInput {
  id: string;
  score: string;
  note: string;
}
