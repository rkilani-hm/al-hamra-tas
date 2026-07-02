// Module M1.11 — Onboarding & MenaME Handoff: data-access layer.
// INTERIM: new M1.11 tables/RPCs not in generated types until Lovable regenerates
// types.ts after apply. Loose-cast now; swap `db` to strict `supabase` after apply.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingDetailData, OnboardingListRow } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function listOnboarding(status?: string | null): Promise<OnboardingListRow[]> {
  const { data, error } = await db.rpc("list_onboarding", { p_status: status ?? undefined, p_limit: 100, p_offset: 0 });
  if (error) throw error;
  return (data ?? []) as unknown as OnboardingListRow[];
}

export async function onboardingDetail(id: string): Promise<OnboardingDetailData> {
  const { data, error } = await db.rpc("onboarding_detail", { p_id: id });
  if (error) throw error;
  return (data ?? { onboarding: null, candidate: null, application: null, adapter: null }) as unknown as OnboardingDetailData;
}

export async function startOnboarding(preboardingId: string): Promise<string> {
  const { data, error } = await db.rpc("start_onboarding", { p_preboarding_id: preboardingId });
  if (error) throw error;
  return data as unknown as string;
}

export async function handoffToMename(onboardingId: string): Promise<{ handoff_status: string; adapter_enabled: boolean }> {
  const { data, error } = await db.rpc("handoff_to_mename", { p_onboarding_id: onboardingId });
  if (error) throw error;
  return data as unknown as { handoff_status: string; adapter_enabled: boolean };
}

export async function completeOnboarding(onboardingId: string, menameRef?: string | null): Promise<void> {
  const { error } = await db.rpc("complete_onboarding", { p_onboarding_id: onboardingId, p_mename_ref: menameRef ?? undefined });
  if (error) throw error;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[onboarding] query failed (showing empty):", err);
      return [];
    }
  };
}
