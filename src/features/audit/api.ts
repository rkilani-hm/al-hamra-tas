// Module M0.5 — Audit: data-access layer.
//
// INTERIM (same pattern as M0.1–M0.4): the tas_audit_log table, v_audit_unified
// view, and the audit RPCs are not in the generated Database type until Lovable
// applies this module's migrations on sync. Until then we access via a
// loosely-typed view of the client. Follow-up: swap `db` back to the strict
// typed `supabase` client (and delete this alias) after the M0.5 migrations apply.
//
// RLS posture: audit reads are authenticated (auditor/admin scope tightened in
// M3.1). The audit_log() writer is service-role only — UI does not write audit.

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { AuditEntry, AuditFilter } from "./types";

const db = supabase as unknown as SupabaseClient;

export async function searchAudit(filter: AuditFilter): Promise<AuditEntry[]> {
  const { data, error } = await db.rpc("search_audit", {
    p_actor: filter.actor ?? null,
    p_module: filter.module ?? null,
    p_event_type: filter.eventType ?? null,
    p_from: filter.from ?? null,
    p_to: filter.to ?? null,
    p_entity_type: filter.entityType ?? null,
    p_entity_ref: filter.entityRef ?? null,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
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
