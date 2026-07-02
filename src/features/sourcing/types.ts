// Module M1.3 — Candidate Sourcing & Talent Pool: types.
export type SourceChannel = "internal" | "referral" | "agency" | "database" | "portal" | "other";
export type PoolStatus = "active" | "passive" | "placed" | "archived";

export interface TalentPoolRow {
  id: string;
  candidate_id: string;
  candidate_name_en: string | null;
  candidate_name_ar: string | null;
  email: string | null;
  source_channel: SourceChannel;
  agency_name: string | null;
  tags: string[];
  pool_status: PoolStatus;
  created_at: string;
}

export interface TalentPoolInput {
  candidate_id: string;
  source_channel: SourceChannel;
  agency_name: string | null;
  referred_by: string | null;
  tags: string[];
  notes: string | null;
}
