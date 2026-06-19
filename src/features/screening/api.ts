// Module M1.6 — Screening & Shortlisting: data-access layer.
//
// INTERIM: the M1.6 tables + RPCs (tas_screening*, list_screening_scorecards,
// create_screening, save_screening_scores, submit_screening, screening_detail)
// are NOT yet in the generated Database types. Until Lovable applies the
// migration and regenerates types.ts, we route these calls through a loosely
// typed client. Swap `db` back to the strict `supabase` client after apply.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  ScreeningRecord,
  ScreeningScorecard,
  ScreeningScoreInput,
  SubmitScreeningResult,
} from "./types";

// INTERIM: swap after apply (use strict `supabase` once types.ts includes M1.6).
const db = supabase as unknown as SupabaseClient;

// --- Reads ------------------------------------------------------------------

export async function listScreeningScorecards(): Promise<ScreeningScorecard[]> {
  const { data, error } = await db.rpc("list_screening_scorecards");
  if (error) throw error;
  return (data ?? []) as unknown as ScreeningScorecard[];
}

export async function screeningDetail(applicationId: string): Promise<ScreeningRecord[]> {
  const { data, error } = await db.rpc("screening_detail", { p_application_id: applicationId });
  if (error) throw error;
  return (data ?? []) as unknown as ScreeningRecord[];
}

// --- Writes (recruiter actions via SECURITY DEFINER RPCs) -------------------

export async function createScreening(
  applicationId: string,
  scorecardId?: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("create_screening", {
    p_application_id: applicationId,
    p_scorecard_id: scorecardId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function saveScreeningScores(
  screeningId: string,
  scores: ScreeningScoreInput[],
): Promise<number | null> {
  const { data, error } = await db.rpc("save_screening_scores", {
    p_screening_id: screeningId,
    p_scores: scores,
  });
  if (error) throw error;
  return (data ?? null) as unknown as number | null;
}

export async function submitScreening(
  screeningId: string,
  recommendation: "shortlist" | "reject" | "hold",
  notesEn?: string | null,
): Promise<SubmitScreeningResult> {
  const { data, error } = await db.rpc("submit_screening", {
    p_screening_id: screeningId,
    p_recommendation: recommendation,
    p_notes_en: notesEn ?? undefined,
  });
  if (error) throw error;
  return data as unknown as SubmitScreeningResult;
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[screening] query failed (showing empty):", err);
      return [];
    }
  };
}
