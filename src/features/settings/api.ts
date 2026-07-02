// Module M3.2 — Admin & System Settings: data-access layer.
// INTERIM: new M3.2 table/RPCs not in generated types until Lovable regenerates.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdapterRow, SystemSetting } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function listSystemSettings(): Promise<SystemSetting[]> {
  const { data, error } = await db.rpc("list_system_settings");
  if (error) throw error;
  return (data ?? []) as unknown as SystemSetting[];
}

export async function setSystemSetting(key: string, value: unknown): Promise<void> {
  const { error } = await db.rpc("set_system_setting", { p_key: key, p_value: value });
  if (error) throw error;
}

export async function listAdapters(): Promise<AdapterRow[]> {
  const { data, error } = await db.rpc("list_adapters");
  if (error) throw error;
  return (data ?? []) as unknown as AdapterRow[];
}

export async function setAdapterEnabled(kind: string, provider: string, enabled: boolean): Promise<void> {
  const { error } = await db.rpc("set_adapter_enabled", { p_kind: kind, p_provider: provider, p_enabled: enabled });
  if (error) throw error;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[settings] query failed (showing empty):", err);
      return [];
    }
  };
}
