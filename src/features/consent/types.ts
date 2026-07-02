// Module M3.1 (consent) — Data Privacy & Candidate Consent: types.
export type ConsentType = "data_processing" | "background_check" | "data_retention" | "marketing";

export interface ConsentRow {
  id: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_at: string | null;
  withdrawn_at: string | null;
  retention_until: string | null;
  source: string | null;
  notes: string | null;
}
