// Module M1.6 — Screening & Shortlisting: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include the M1.6
// tables + RPCs after Lovable applied the migration and regenerated types.ts).
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  ScreeningRecord,
  ScreeningScorecard,
  ScreeningScoreInput,
  SubmitScreeningResult,
} from "./types";

// --- Reads ------------------------------------------------------------------

export async function listScreeningScorecards(): Promise<ScreeningScorecard[]> {
  const { data, error } = await supabase.rpc("list_screening_scorecards");
  if (error) throw error;
  // RPC returns a Json array — cast to the view model.
  return (data ?? []) as unknown as ScreeningScorecard[];
}

export async function screeningDetail(applicationId: string): Promise<ScreeningRecord[]> {
  const { data, error } = await supabase.rpc("screening_detail", { p_application_id: applicationId });
  if (error) throw error;
  return (data ?? []) as unknown as ScreeningRecord[];
}

// --- Writes (recruiter actions via SECURITY DEFINER RPCs) -------------------

export async function createScreening(
  applicationId: string,
  scorecardId?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_screening", {
    p_application_id: applicationId,
    p_scorecard_id: scorecardId ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function saveScreeningScores(
  screeningId: string,
  scores: ScreeningScoreInput[],
): Promise<number | null> {
  const { data, error } = await supabase.rpc("save_screening_scores", {
    p_screening_id: screeningId,
    p_scores: scores as unknown as Json,
  });
  if (error) throw error;
  return data ?? null;
}

export async function submitScreening(
  screeningId: string,
  recommendation: "shortlist" | "reject" | "hold",
  notesEn?: string | null,
): Promise<SubmitScreeningResult> {
  const { data, error } = await supabase.rpc("submit_screening", {
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
