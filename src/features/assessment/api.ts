// Module M1.8 — Assessment & Evaluation: data-access layer.
// INTERIM: new M1.8 tables/RPCs not in generated types until Lovable regenerates
// types.ts after apply. Loose-cast now; swap `db` to strict `supabase` after apply.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentDetailData, AssessmentListRow } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function listAssessments(applicationId?: string | null): Promise<AssessmentListRow[]> {
  const { data, error } = await db.rpc("list_assessments", {
    p_application_id: applicationId ?? undefined,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AssessmentListRow[];
}

export async function assessmentDetail(id: string): Promise<AssessmentDetailData> {
  const { data, error } = await db.rpc("assessment_detail", { p_id: id });
  if (error) throw error;
  return (data ?? { assessment: null, items: [] }) as unknown as AssessmentDetailData;
}

export async function createAssessment(applicationId: string, type: string, title?: string | null): Promise<string> {
  const { data, error } = await db.rpc("create_assessment", {
    p_application_id: applicationId,
    p_type: type,
    p_title: title ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function saveAssessmentItems(
  assessmentId: string,
  items: { id: string; score: number | null; note: string | null }[],
): Promise<number | null> {
  const { data, error } = await db.rpc("save_assessment_items", { p_assessment_id: assessmentId, p_items: items });
  if (error) throw error;
  return (data ?? null) as unknown as number | null;
}

export async function submitAssessment(assessmentId: string, recommendation: string, notes?: string | null): Promise<void> {
  const { error } = await db.rpc("submit_assessment", {
    p_assessment_id: assessmentId,
    p_recommendation: recommendation,
    p_notes: notes ?? undefined,
  });
  if (error) throw error;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[assessment] query failed (showing empty):", err);
      return [];
    }
  };
}
