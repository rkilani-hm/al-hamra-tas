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

// --- Config writes (M3.1-step1, SYSTEM_ADMIN-gated RPCs) ---------------------

export interface ScorecardInput {
  id?: string | null;
  code: string;
  name_en: string;
  name_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  status?: string | null;
}

export async function upsertScorecard(input: ScorecardInput): Promise<string> {
  const { data, error } = await supabase.rpc("config_upsert_scorecard", {
    p_id: input.id ?? undefined,
    p_code: input.code,
    p_name_en: input.name_en,
    p_name_ar: input.name_ar,
    p_description_en: input.description_en ?? undefined,
    p_description_ar: input.description_ar ?? undefined,
    p_status: input.status ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export interface CriterionInput {
  id?: string | null;
  scorecard_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  weight?: number | null;
  max_score?: number | null;
  sort_order?: number | null;
}

export async function upsertCriterion(input: CriterionInput): Promise<string> {
  const { data, error } = await supabase.rpc("config_upsert_criterion", {
    p_id: input.id ?? undefined,
    p_scorecard_id: input.scorecard_id,
    p_code: input.code,
    p_name_en: input.name_en,
    p_name_ar: input.name_ar,
    p_weight: input.weight ?? undefined,
    p_max_score: input.max_score ?? undefined,
    p_sort_order: input.sort_order ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
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
