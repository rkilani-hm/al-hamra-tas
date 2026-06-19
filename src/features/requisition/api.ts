// Module M1.2 — Job Requisition: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include the M1.2
// tables + RPCs after the migration was applied). Existing M0.x tables are read
// via the config/identity feature APIs (org cascade, job catalog, JD templates,
// lookups), which are already strictly typed.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  BudgetedCheck,
  RequisitionDetailData,
  RequisitionDraftInput,
  RequisitionListRow,
  RequisitionRecord,
  RequisitionFilter,
} from "./types";

// --- Reads (RPC) ------------------------------------------------------------

export async function listRequisitions(
  filter: RequisitionFilter,
): Promise<RequisitionListRow[]> {
  const { data, error } = await supabase.rpc("list_requisitions", {
    p_status: filter.status ?? undefined,
    p_department_id: filter.departmentId ?? undefined,
    p_position_id: filter.positionId ?? undefined,
    p_from: filter.from ?? undefined,
    p_to: filter.to ?? undefined,
    p_mine: filter.mine ?? false,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as RequisitionListRow[];
}

export async function requisitionDetail(id: string): Promise<RequisitionDetailData> {
  const { data, error } = await supabase.rpc("requisition_detail", { p_id: id });
  if (error) throw error;
  // requisition_detail returns a Json object — cast to the view model.
  return (data ?? { requisition: null, jd_snapshot: null, instance: null, events: [] }) as unknown as RequisitionDetailData;
}

// Derive-on-read: call before rendering the detail to apply terminal transitions.
export async function syncRequisitionStatus(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("sync_requisition_status", { p_requisition_id: id });
  if (error) throw error;
  return (data ?? null) as string | null;
}

export async function checkBudgetedPosition(
  positionId: string,
  departmentId: string | null,
  headcount: number,
): Promise<BudgetedCheck | null> {
  const { data, error } = await supabase.rpc("check_budgeted_position", {
    p_job_position_id: positionId,
    // Generated as required string, but the SQL treats null as "no department".
    p_department_id: (departmentId ?? null) as unknown as string,
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
  const { data, error } = await supabase
    .from("tas_requisition")
    .insert({
      ...input,
      status: "draft",
      jd_snapshot_json: (input.jd_snapshot_json ?? {}) as Json,
    })
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
  const { jd_snapshot_json, ...rest } = patch;
  const payload =
    jd_snapshot_json !== undefined
      ? { ...rest, jd_snapshot_json: jd_snapshot_json as Json }
      : rest;
  const { error } = await supabase.from("tas_requisition").update(payload).eq("id", id);
  if (error) throw error;
}

// Submit (service-role-guarded RPC; fails-soft for authenticated until M3.1).
export async function submitRequisition(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_requisition", { p_requisition_id: id });
  if (error) throw error;
}

// Lifecycle transition (service-role-guarded RPC; fails-soft until M3.1).
export async function transitionRequisition(id: string, action: string): Promise<void> {
  const { error } = await supabase.rpc("transition_requisition", {
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
