// Module M1.9 — Offer Management: TypeScript types.
// Mirrors supabase/migrations/20260619200000_m1_9_offers.sql + RPC shapes.

export type OfferStatus =
  | "draft"
  | "in_approval"
  | "approved"
  | "issued"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export type EsignStatus = "none" | "pending" | "signed" | "skipped" | "failed";
export type OfferDecision = "accept" | "decline";
export type OfferAction = "cancel" | "expire";

export interface OfferRecord {
  id: string;
  reference: string | null;
  application_id: string;
  candidate_id: string;
  job_position_id: string | null;
  job_grade_id: string | null;
  salary_amount: number | null;
  currency: string;
  salary_components_json: Record<string, unknown>;
  employment_type: string | null;
  contract_type: string | null;
  start_date: string | null;
  probation_months: number | null;
  terms_en: string | null;
  terms_ar: string | null;
  expiry_date: string | null;
  letter_template_id: string | null;
  letter_snapshot_json: Record<string, unknown>;
  status: OfferStatus;
  workflow_instance_id: string | null;
  esign_status: EsignStatus;
  accepted_at: string | null;
  declined_reason: string | null;
  onboarding_ready: boolean;
  created_by: string | null;
  created_at: string;
}

// list_offers() row.
export interface OfferListRow {
  id: string;
  reference: string | null;
  application_id: string;
  candidate_id: string;
  candidate_name_en: string | null;
  candidate_name_ar: string | null;
  salary_amount: number | null;
  currency: string;
  status: OfferStatus;
  esign_status: EsignStatus;
  onboarding_ready: boolean;
  created_at: string;
}

export interface OfferEvent {
  id: string;
  event_type: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
}

// Frozen bilingual letter snapshot.
export interface OfferLetterSnapshot {
  reference?: string | null;
  candidate_en?: string | null;
  candidate_ar?: string | null;
  salary_amount?: number | null;
  currency?: string | null;
  start_date?: string | null;
  contract_type?: string | null;
  employment_type?: string | null;
  probation_months?: number | null;
  terms_en?: string | null;
  terms_ar?: string | null;
  title_en?: string | null;
  title_ar?: string | null;
  body_en?: string | null;
  body_ar?: string | null;
}

// offer_detail() jsonb shape.
export interface OfferDetailData {
  offer: OfferRecord | null;
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
  instance: { instance?: { status?: string } } | null;
  letter_snapshot: OfferLetterSnapshot | null;
  events: OfferEvent[];
}

export interface OfferDraftInput {
  application_id: string;
  candidate_id: string;
  job_position_id?: string | null;
  job_grade_id?: string | null;
  salary_amount?: number | null;
  currency?: string;
  employment_type?: string | null;
  contract_type?: string | null;
  start_date?: string | null;
  probation_months?: number | null;
  terms_en?: string | null;
  terms_ar?: string | null;
  expiry_date?: string | null;
}

export interface OfferFilter {
  applicationId?: string | null;
  candidateId?: string | null;
  status?: string | null;
  mine?: boolean;
  limit?: number;
  offset?: number;
}
