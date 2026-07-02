// Module M1.3 — Candidate Sourcing & Talent Pool: data-access layer.
// INTERIM: new M1.3 table/RPCs not in generated types until Lovable regenerates
// types.ts after apply. Loose-cast now; swap `db` to strict `supabase` after apply.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TalentPoolInput, TalentPoolRow } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function listTalentPool(channel?: string | null, status?: string | null): Promise<TalentPoolRow[]> {
  const { data, error } = await db.rpc("list_talent_pool", {
    p_channel: channel ?? undefined,
    p_status: status ?? undefined,
    p_limit: 200,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TalentPoolRow[];
}

export async function addToTalentPool(input: TalentPoolInput): Promise<string> {
  const { data, error } = await db.rpc("add_to_talent_pool", {
    p_candidate_id: input.candidate_id,
    p_channel: input.source_channel,
    p_agency: input.agency_name ?? undefined,
    p_referred_by: input.referred_by ?? undefined,
    p_tags: input.tags,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function updatePoolStatus(id: string, status: string): Promise<void> {
  const { error } = await db.rpc("update_pool_status", { p_id: id, p_status: status });
  if (error) throw error;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[sourcing] query failed (showing empty):", err);
      return [];
    }
  };
}
