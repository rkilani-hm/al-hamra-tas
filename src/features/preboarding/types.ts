// Module M1.10 — Pre-Boarding & Document Collection: types.
export type PreBoardingStatus = "in_progress" | "completed" | "cancelled";
export type ItemStatus = "pending" | "collected" | "verified" | "waived";
export type DocCategory = "civil_id" | "passport" | "visa_residency" | "certificate" | "other";

export interface PreBoardingRecord {
  id: string;
  application_id: string;
  candidate_id: string | null;
  offer_id: string | null;
  status: PreBoardingStatus;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface PreBoardingItem {
  id: string;
  doc_category: DocCategory;
  label_en: string | null;
  label_ar: string | null;
  required: boolean;
  status: ItemStatus;
  document_id: string | null;
  waived_reason: string | null;
  collected_at: string | null;
  verified_at: string | null;
}

export interface PreBoardingDetailData {
  preboarding: PreBoardingRecord | null;
  candidate: { id: string; full_name_en: string | null; full_name_ar: string | null; email: string | null } | null;
  application: { id: string; reference: string | null; status: string } | null;
  items: PreBoardingItem[];
}

export interface PreBoardingListRow {
  id: string;
  application_id: string;
  candidate_id: string | null;
  candidate_name_en: string | null;
  candidate_name_ar: string | null;
  reference: string | null;
  status: PreBoardingStatus;
  required_total: number;
  required_done: number;
  started_at: string;
}
