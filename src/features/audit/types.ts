// Module M0.5 — Audit: TypeScript types. Mirrors v_audit_unified / search_audit.

export type AuditSource = "audit_log" | "access_audit";

export interface AuditEntry {
  id: string;
  actor_user_id: string | null;
  module_code: string | null;
  event_type: string | null;
  entity_type: string | null;
  entity_ref: string | null;
  detail_json: Record<string, unknown>;
  ip: string | null;
  created_at: string;
  source: AuditSource;
}

export interface AuditFilter {
  actor?: string | null;
  module?: string | null;
  eventType?: string | null;
  from?: string | null; // ISO
  to?: string | null; // ISO
  entityType?: string | null;
  entityRef?: string | null;
  limit?: number;
  offset?: number;
}
