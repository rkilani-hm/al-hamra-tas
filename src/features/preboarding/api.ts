// Module M1.10 — Pre-Boarding & Document Collection: data-access layer.
import { supabase } from "@/integrations/supabase/client";
import type { PreBoardingDetailData, PreBoardingListRow } from "./types";

const db = supabase;

// --- Reads (open) -----------------------------------------------------------
export async function listPreboarding(status?: string | null): Promise<PreBoardingListRow[]> {
  const { data, error } = await db.rpc("list_preboarding", {
    p_status: status ?? undefined,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as PreBoardingListRow[];
}

export async function preboardingDetail(id: string): Promise<PreBoardingDetailData> {
  const { data, error } = await db.rpc("preboarding_detail", { p_id: id });
  if (error) throw error;
  return (data ?? { preboarding: null, candidate: null, application: null, items: [] }) as unknown as PreBoardingDetailData;
}

// --- Writes (gated preboarding.manage server-side) --------------------------
export async function startPreboarding(applicationId: string): Promise<string> {
  const { data, error } = await db.rpc("start_preboarding", { p_application_id: applicationId });
  if (error) throw error;
  return data as unknown as string;
}

export async function setPreboardingItem(
  itemId: string,
  status: string,
  documentId?: string | null,
  reason?: string | null,
): Promise<void> {
  const { error } = await db.rpc("set_preboarding_item", {
    p_item_id: itemId,
    p_status: status,
    p_document_id: documentId ?? undefined,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export async function completePreboarding(id: string): Promise<void> {
  const { error } = await db.rpc("complete_preboarding", { p_preboarding_id: id });
  if (error) throw error;
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[preboarding] query failed (showing empty):", err);
      return [];
    }
  };
}
