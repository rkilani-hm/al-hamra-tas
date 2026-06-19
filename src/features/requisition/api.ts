// Module M1.2 — Job Requisition: data-access layer.
//
// Strict typed `supabase` client is reused for EXISTING M0.x tables via the
// config/identity feature APIs (org cascade, job catalog, JD templates, lookups).
// The brand-new M1.2 tables + RPCs aren't in the generated Database type until
// Lovable applies this module's migration, so they go through a loosely-typed
// view of the client:
//   // INTERIM: swap after apply
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  BudgetedCheck,
  RequisitionDetailData,
  RequisitionDraftInput,
  RequisitionListRow,
  RequisitionRecord,
  RequisitionFilter,
} from "./types";

// INTERIM: swap after apply — remove this cast once tas_requisition /
// tas_budgeted_position / tas_requisition_event + RPCs land in types.ts.
const db = supabase as unknown as SupabaseClient;

// --- Reads (RPC) ------------------------------------------------------------

export async function listRequisitions(
  filter: RequisitionFilter,
): Promise<RequisitionListRow[]> {
  const { data, error } = await db.rpc("list_requisitions", {
    p_status: filter.status ?? null,
    p_department_id: filter.departmentId ?? null,
    p_position_id: filter.positionId ?? null,
    p_from: filter.from ?? null,
    p_to: filter.to ?? null,
    p_mine: filter.mine ?? false,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as RequisitionListRow[];
}

export async function requisitionDetail(id: string): Promise<RequisitionDetailData> {
  const { data, error } = await db.rpc("requisition_detail", { p_id: id });
  if (error) throw error;
  return (data ?? { requisition: null, jd_snapshot: null, instance: null, events: [] }) as RequisitionDetailData;
}

// Derive-on-read: call before rendering the detail to apply terminal transitions.
export async function syncRequisitionStatus(id: string): Promise<string | null> {
  const { data, error } = await db.rpc("sync_requisition_status", { p_requisition_id: id });
  if (error) throw error;
  return (data ?? null) as string | null;
}

export async function checkBudgetedPosition(
  positionId: string,
  departmentId: string | null,
  headcount: number,
): Promise<BudgetedCheck | null> {
  const { data, error } = await db.rpc("check_budgeted_position", {
    p_job_position_id: positionId,
    p_department_id: departmentId,
    p_headcount: headcount,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as BudgetedCheck | null;
}

// --- Writes -----------------------------------------------------------------

// Create an own-draft requisition (authenticated own-draft INSERT via RLS).
export async function createDraftRequisition(
  input: RequisitionDraftInput,
): Promise<RequisitionRecord> {
  const { data, error } = await db
    .from("tas_requisition")
    .insert({ ...input, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as RequisitionRecord;
}

// Update a draft's fields. NOTE: per the M1.2 RLS, non-status writes are
// service-role until M3.1 — this fails-soft for authenticated callers for now.
export async function updateDraftRequisition(
  id: string,
  patch: Partial<RequisitionDraftInput>,
): Promise<void> {
  const { error } = await db.from("tas_requisition").update(patch).eq("id", id);
  if (error) throw error;
}

// Submit (service-role-guarded RPC; fails-soft for authenticated until M3.1).
export async function submitRequisition(id: string): Promise<void> {
  const { error } = await db.rpc("submit_requisition", { p_requisition_id: id });
  if (error) throw error;
}

// Lifecycle transition (service-role-guarded RPC; fails-soft until M3.1).
export async function transitionRequisition(id: string, action: string): Promise<void> {
  const { error } = await db.rpc("transition_requisition", {
    p_requisition_id: id,
    p_action: action,
  });
  if (error) throw error;
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[requisition] query failed (showing empty):", err);
      return [];
    }
  };
}
