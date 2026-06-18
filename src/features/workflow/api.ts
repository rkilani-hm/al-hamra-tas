// Module M0.3 — Workflow & Approval Engine: data-access layer.
//
// INTERIM (same pattern as M0.1/M0.2): the workflow tables and RPC functions are
// not in the generated Database type until Lovable applies this module's
// migrations on sync. Until then, PostgREST table/rpc names don't type-check, so
// we access through a loosely-typed view of the client. Follow-up: swap `db`
// back to the strict typed `supabase` client (and delete this alias) after the
// M0.3 migrations are applied — mirrors the M0.1/M0.2 cleanups.
//
// RLS posture: definitions/steps are readable by authenticated; instance/task/
// history/event are self-scoped reads. All WRITES (and admin RPCs activate/
// submit) are service-role only until M3.1 — those calls fail-soft in the UI.
// The user-facing RPCs act_on_task / my_pending_tasks / instance_timeline are
// granted to authenticated.

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  InstanceTimeline,
  PendingTask,
  StepDraft,
  TaskAction,
  WorkflowDefinition,
  WorkflowStep,
} from "./types";

const db = supabase as unknown as SupabaseClient;

// --- Definitions / steps (PostgREST) ---------------------------------------

export async function listDefinitions(): Promise<WorkflowDefinition[]> {
  const { data, error } = await db
    .from("tas_workflow_definition")
    .select("id, request_type, version, name_en, name_ar, status")
    .order("request_type")
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkflowDefinition[];
}

export async function createDefinition(input: {
  request_type: string;
  version: number;
  name_en: string;
  name_ar: string;
}): Promise<WorkflowDefinition> {
  const { data, error } = await db
    .from("tas_workflow_definition")
    .insert({ ...input, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as WorkflowDefinition;
}

export async function archiveDefinition(id: string): Promise<void> {
  const { error } = await db
    .from("tas_workflow_definition")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) throw error;
}

export async function listSteps(definitionId: string): Promise<WorkflowStep[]> {
  const { data, error } = await db
    .from("tas_workflow_step")
    .select(
      "id, definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, condition_json, quorum, sla_hours, on_reject",
    )
    .eq("definition_id", definitionId)
    .order("step_no");
  if (error) throw error;
  return (data ?? []) as WorkflowStep[];
}

// Replace the full ordered step set for a definition (step_no = order index + 1).
export async function saveSteps(
  definitionId: string,
  steps: StepDraft[],
): Promise<void> {
  const { error: delErr } = await db
    .from("tas_workflow_step")
    .delete()
    .eq("definition_id", definitionId);
  if (delErr) throw delErr;

  if (steps.length === 0) return;
  const rows = steps.map((s, i) => ({
    definition_id: definitionId,
    step_no: i + 1,
    name_en: s.name_en,
    name_ar: s.name_ar,
    approver_rule_type: s.approver_rule_type,
    approver_rule_value: s.approver_rule_value,
    condition_json: s.condition_json,
    quorum: s.quorum,
    sla_hours: s.sla_hours,
    on_reject: s.on_reject,
  }));
  const { error: insErr } = await db.from("tas_workflow_step").insert(rows);
  if (insErr) throw insErr;
}

// --- RPC wrappers -----------------------------------------------------------

// Admin RPC (service-role only until M3.1; fails-soft for authenticated).
export async function activateWorkflow(definitionId: string): Promise<void> {
  const { error } = await db.rpc("activate_workflow", {
    p_definition_id: definitionId,
  });
  if (error) throw error;
}

// Module/service RPC (service-role only until M3.1). Returns the new instance id.
export async function submitWorkflow(input: {
  request_type: string;
  request_ref: string;
  requester_id: string;
  entity_id?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  context_json?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await db.rpc("submit_workflow", {
    p_request_type: input.request_type,
    p_request_ref: input.request_ref,
    p_requester_id: input.requester_id,
    p_entity_id: input.entity_id ?? null,
    p_branch_id: input.branch_id ?? null,
    p_department_id: input.department_id ?? null,
    p_context_json: input.context_json ?? {},
  });
  if (error) throw error;
  return data as string;
}

// User-facing RPC (granted to authenticated; self-guards by JWT assignee match).
export async function actOnTask(input: {
  task_id: string;
  action: TaskAction;
  comment?: string | null;
  comment_ar?: string | null;
  target?: string | null;
}): Promise<void> {
  const { error } = await db.rpc("act_on_task", {
    p_task_id: input.task_id,
    p_action: input.action,
    p_comment: input.comment ?? null,
    p_comment_ar: input.comment_ar ?? null,
    p_target: input.target ?? null,
  });
  if (error) throw error;
}

export async function myPendingTasks(userId: string): Promise<PendingTask[]> {
  const { data, error } = await db.rpc("my_pending_tasks", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as PendingTask[];
}

export async function instanceTimeline(
  instanceId: string,
): Promise<InstanceTimeline> {
  const { data, error } = await db.rpc("instance_timeline", {
    p_instance_id: instanceId,
  });
  if (error) throw error;
  return (data ?? { instance: null, steps: [], tasks: [], history: [] }) as InstanceTimeline;
}

// --- Shared helper: degrade a read to empty on error (defensive guard). ------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[workflow] query failed (showing empty):", err);
      return [];
    }
  };
}
