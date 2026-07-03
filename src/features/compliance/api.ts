// Module M3.3 — Audit & Compliance Reporting: data-access layer.
import { supabase } from "@/integrations/supabase/client";
import type { AuditReportRow, AuditStats } from "./types";

const db = supabase;

export async function auditStats(): Promise<AuditStats | null> {
  const { data, error } = await db.rpc("audit_stats");
  if (error) throw error;
  return (data ?? null) as unknown as AuditStats | null;
}

export async function auditReport(module?: string | null): Promise<AuditReportRow[]> {
  const { data, error } = await db.rpc("audit_report", { p_module: module ?? undefined, p_limit: 200, p_offset: 0 });
  if (error) throw error;
  return (data ?? []) as unknown as AuditReportRow[];
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[compliance] query failed (showing empty):", err);
      return [];
    }
  };
}
