// Module M3.1 (consent) — Data Privacy & Candidate Consent: data-access layer.
// INTERIM: new table/RPCs not in generated types until Lovable regenerates.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentRow } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function listCandidateConsents(candidateId: string): Promise<ConsentRow[]> {
  const { data, error } = await db.rpc("list_candidate_consents", { p_candidate_id: candidateId });
  if (error) throw error;
  return (data ?? []) as unknown as ConsentRow[];
}

export async function recordConsent(
  candidateId: string,
  type: string,
  granted: boolean,
  retentionUntil?: string | null,
  source?: string | null,
  notes?: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("record_consent", {
    p_candidate_id: candidateId,
    p_type: type,
    p_granted: granted,
    p_retention_until: retentionUntil ?? undefined,
    p_source: source ?? undefined,
    p_notes: notes ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}
