// Module M2.5 — Interview Meeting Notes + AI Summarization: data-access layer.
// INTERIM: new M2.5 table/RPCs are not in the generated Database types until
// Lovable regenerates types.ts after the migration applies. Loose-cast now; swap
// `db` to the strict `supabase` client after apply.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export type MeetingRecommendation = "proceed" | "hold" | "reject";

export interface InterviewNote {
  id: string;
  interview_id: string;
  raw_text: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  key_points: string[];
  recommendation: MeetingRecommendation | null;
  ai_generated: boolean;
  created_at: string;
}

export interface SummarizeResult {
  dormant: boolean;
  output: { summary_en: string; summary_ar: string; key_points: string[]; recommendation: string } | null;
  message: string;
}

export async function listInterviewNotes(interviewId: string): Promise<InterviewNote[]> {
  const { data, error } = await db.rpc("list_interview_notes", { p_interview_id: interviewId });
  if (error) throw error;
  return (data ?? []) as unknown as InterviewNote[];
}

export async function saveInterviewNote(interviewId: string, rawText: string): Promise<string> {
  const { data, error } = await db.rpc("save_interview_note", { p_interview_id: interviewId, p_raw_text: rawText });
  if (error) throw error;
  return data as unknown as string;
}

export async function summarizeMeeting(noteId: string): Promise<SummarizeResult> {
  // 1) RPC gates ai.use, audits, and reports the adapter's dormant/enabled state.
  const { data, error } = await db.rpc("ai_summarize_meeting", { p_note_id: noteId });
  if (error) throw error;
  const gate = data as unknown as SummarizeResult;
  if (gate?.dormant) return gate;

  // 2) Adapter enabled -> the ai-copilot edge function summarizes + persists.
  const { data: fn, error: fnErr } = await db.functions.invoke("ai-copilot", {
    body: { task: "summarize_meeting", note_id: noteId },
  });
  if (fnErr) throw fnErr;
  return fn as unknown as SummarizeResult;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[meeting-notes] query failed (showing empty):", err);
      return [];
    }
  };
}
