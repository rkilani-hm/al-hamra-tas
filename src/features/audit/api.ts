// Module M0.5 — Audit: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include tas_audit_log,
// v_audit_unified, and the audit RPCs after the M0.5 migrations were applied).
//
// RLS posture: audit reads are authenticated (auditor/admin scope tightened in
// M3.1). The audit_log() writer is service-role only — UI does not write audit.

import { supabase } from "@/integrations/supabase/client";
import type { AuditEntry, AuditFilter } from "./types";

export async function searchAudit(filter: AuditFilter): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("search_audit", {
    p_actor: filter.actor ?? undefined,
    p_module: filter.module ?? undefined,
    p_event_type: filter.eventType ?? undefined,
    p_from: filter.from ?? undefined,
    p_to: filter.to ?? undefined,
    p_entity_type: filter.entityType ?? undefined,
    p_entity_ref: filter.entityRef ?? undefined,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  // search_audit returns detail_json as Json and source as string; the row shape
  // otherwise matches AuditEntry. Cast through to the view model.
  return (data ?? []) as unknown as AuditEntry[];
}

// Shared helper: degrade a read to empty on error (defensive guard).
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[audit] query failed (showing empty):", err);
      return [];
    }
  };
}
