// Module M1.11 — Onboarding & MenaME Handoff: types.
export type OnboardingStatus = "pending" | "handed_off" | "completed" | "cancelled";
export type HandoffStatus = "not_sent" | "queued" | "sent" | "ack" | "error";

export interface OnboardingRecord {
  id: string;
  preboarding_id: string;
  application_id: string | null;
  candidate_id: string | null;
  status: OnboardingStatus;
  mename_employee_ref: string | null;
  handoff_status: HandoffStatus;
  handoff_payload: Record<string, unknown>;
  handed_off_at: string | null;
  notes: string | null;
}

export interface OnboardingDetailData {
  onboarding: OnboardingRecord | null;
  candidate: { id: string; full_name_en: string | null; full_name_ar: string | null; email: string | null } | null;
  application: { id: string; reference: string | null; status: string } | null;
  adapter: { provider: string; is_enabled: boolean; config_status: string } | null;
}

export interface OnboardingListRow {
  id: string;
  application_id: string | null;
  candidate_id: string | null;
  candidate_name_en: string | null;
  candidate_name_ar: string | null;
  reference: string | null;
  status: OnboardingStatus;
  handoff_status: HandoffStatus;
  mename_employee_ref: string | null;
  created_at: string;
}
