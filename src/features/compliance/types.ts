// Module M3.3 — Audit & Compliance Reporting: types.
export interface AuditStats {
  total: number;
  last_24h: number;
  by_module: { module_code: string; count: number }[];
  by_event: { event_type: string; count: number }[];
}

export interface AuditReportRow {
  id: string;
  created_at: string;
  actor_name: string;
  module_code: string | null;
  event_type: string | null;
  entity_type: string | null;
  entity_ref: string | null;
}
