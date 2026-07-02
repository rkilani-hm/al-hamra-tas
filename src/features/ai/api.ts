// Module M2.1 — AI Recruitment Copilot: data-access layer.
// INTERIM: new M2.1 table/RPCs not in generated types until Lovable regenerates.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export interface AiStatus {
  provider?: string;
  is_enabled: boolean;
  config_status: string;
  model?: string | null;
}

export interface AiJdResult {
  dormant: boolean;
  output: string | null;
  message: string;
}

export async function aiStatus(): Promise<AiStatus> {
  const { data, error } = await db.rpc("ai_status");
  if (error) throw error;
  return (data ?? { is_enabled: false, config_status: "unconfigured" }) as unknown as AiStatus;
}

export async function aiGenerateJd(title: string, notes?: string | null): Promise<AiJdResult> {
  // 1) RPC gates on ai.use, audits, and reports the adapter's dormant/enabled state.
  const { data, error } = await db.rpc("ai_generate_jd", { p_title: title, p_notes: notes ?? undefined });
  if (error) throw error;
  const gate = data as unknown as AiJdResult;
  if (gate?.dormant) return gate;

  // 2) Adapter enabled -> the ai-copilot edge function performs the real generation.
  const { data: fn, error: fnErr } = await db.functions.invoke("ai-copilot", {
    body: { task: "generate_jd", title, notes: notes ?? undefined },
  });
  if (fnErr) throw fnErr;
  return fn as unknown as AiJdResult;
}
