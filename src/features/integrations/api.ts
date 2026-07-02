// Module M2.3 — Microsoft 365 Integration: data-access layer.
// INTERIM: m365_status RPC not in generated types until Lovable regenerates.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export interface M365Component {
  component: string;
  kind: string;
  status?: string;
  provider?: string;
  is_enabled?: boolean;
  config_status?: string;
}

export interface M365Status {
  entra: M365Component;
  outlook: M365Component | null;
  teams: M365Component | null;
  sharepoint: M365Component | null;
}

export async function m365Status(): Promise<M365Status | null> {
  const { data, error } = await db.rpc("m365_status");
  if (error) throw error;
  return (data ?? null) as unknown as M365Status | null;
}

export async function setAdapterEnabled(kind: string, provider: string, enabled: boolean): Promise<void> {
  const { error } = await db.rpc("set_adapter_enabled", { p_kind: kind, p_provider: provider, p_enabled: enabled });
  if (error) throw error;
}

// --- M2.2 MenaME HRMS ---------------------------------------------------------
export interface MenameStatus {
  adapter: { provider: string; is_enabled: boolean; config_status: string } | null;
  queued_handoffs: number;
}

export interface MenameTestResult {
  ok: boolean;
  dormant: boolean;
  message: string;
}

export async function menameStatus(): Promise<MenameStatus | null> {
  const { data, error } = await db.rpc("mename_status");
  if (error) throw error;
  return (data ?? null) as unknown as MenameStatus | null;
}

export async function menameTestConnection(): Promise<MenameTestResult> {
  const { data, error } = await db.rpc("mename_test_connection");
  if (error) throw error;
  return data as unknown as MenameTestResult;
}
