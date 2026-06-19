// Module M1.7 — Interview Management: data-access layer.
//
// Strict typed `supabase` client for EXISTING tables (tas_lookup). INTERIM
// loose-typed cast for the NEW M1.7 RPCs/tables until Lovable applies the
// migration and regenerates types.ts — swap `db` back to the strict client then.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  InterviewDetailData,
  InterviewListFilter,
  InterviewListRow,
  InterviewScoreInput,
  PanelSummary,
  RoundType,
  ScheduleInterviewInput,
} from "./types";

// INTERIM: swap to strict client after Lovable applies migration (regen types.ts).
const db = supabase as unknown as SupabaseClient;

// --- Reference data (existing table — strict client) ------------------------

export async function listRoundTypes(): Promise<RoundType[]> {
  const { data, error } = await supabase
    .from("tas_lookup")
    .select("id, code, name_en, name_ar, sort_order")
    .eq("lookup_type", "interview_round")
    .eq("status", "active")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as RoundType[];
}

// --- Reads (INTERIM new RPCs) -----------------------------------------------

export async function listInterviews(filter: InterviewListFilter): Promise<InterviewListRow[]> {
  const { data, error } = await db.rpc("list_interviews", {
    p_application_id: filter.applicationId ?? undefined,
    p_status: filter.status ?? undefined,
    p_mine: filter.mine ?? false,
    p_from: filter.from ?? undefined,
    p_to: filter.to ?? undefined,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as InterviewListRow[];
}

export async function interviewDetail(id: string): Promise<InterviewDetailData> {
  const { data, error } = await db.rpc("interview_detail", { p_id: id });
  if (error) throw error;
  return (data ?? {
    interview: null, application: null, candidate: null, panelists: [], scores: [], criteria: [],
  }) as unknown as InterviewDetailData;
}

export async function interviewPanelSummary(id: string): Promise<PanelSummary> {
  const { data, error } = await db.rpc("interview_panel_summary", { p_interview_id: id });
  if (error) throw error;
  return data as unknown as PanelSummary;
}

// --- Writes (recruiter / panelist actions via SECURITY DEFINER RPCs) --------

export async function scheduleInterview(input: ScheduleInterviewInput): Promise<string> {
  const { data, error } = await db.rpc("schedule_interview", {
    p_application_id: input.applicationId,
    p_round_type: input.roundType ?? undefined,
    p_scheduled_at: input.scheduledAt ?? undefined,
    p_duration_min: input.durationMin ?? 60,
    p_mode: input.mode,
    p_location: input.location ?? undefined,
    p_panelist_ids: input.panelistIds,
    p_scorecard_id: input.scorecardId ?? undefined,
  });
  if (error) throw error;
  const id = data as unknown as string;
  // Best-effort: kick the dormant Graph adapter (fire-and-forget, never blocks).
  void invokeScheduleAdapter(id);
  return id;
}

export async function submitInterviewScore(
  interviewId: string,
  scores: InterviewScoreInput[],
  recommendation: "proceed" | "reject" | "hold",
  notesEn?: string | null,
): Promise<number | null> {
  const { data, error } = await db.rpc("submit_interview_score", {
    p_interview_id: interviewId,
    p_scores: scores,
    p_recommendation: recommendation,
    p_notes_en: notesEn ?? undefined,
  });
  if (error) throw error;
  return (data ?? null) as unknown as number | null;
}

export async function recordInterviewOutcome(
  interviewId: string,
  outcome: "proceed" | "reject" | "hold",
): Promise<void> {
  const { error } = await db.rpc("record_interview_outcome", {
    p_interview_id: interviewId,
    p_outcome: outcome,
  });
  if (error) throw error;
}

export async function rescheduleInterview(interviewId: string, newDatetime: string): Promise<void> {
  const { error } = await db.rpc("reschedule_interview", {
    p_interview_id: interviewId,
    p_new_datetime: newDatetime,
  });
  if (error) throw error;
  void invokeScheduleAdapter(interviewId);
}

export async function cancelInterview(interviewId: string, reason?: string | null): Promise<void> {
  const { error } = await db.rpc("cancel_interview", {
    p_interview_id: interviewId,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

// Fire-and-forget invoke of the interview-schedule edge function. Swallows all
// errors — in-app scheduling already succeeded; calendar creation is best-effort.
async function invokeScheduleAdapter(interviewId: string): Promise<void> {
  try {
    await db.functions.invoke("interview-schedule", { body: { interview_id: interviewId } });
  } catch (err) {
    console.warn("[interviews] schedule adapter invoke failed (non-blocking):", err);
  }
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[interviews] query failed (showing empty):", err);
      return [];
    }
  };
}
