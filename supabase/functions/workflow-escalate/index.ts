// =============================================================================
// Edge Function: workflow-escalate  (Module M0.3 — Workflow & Approval Engine)
// =============================================================================
// Cron sweep: finds pending workflow tasks past their due_at, marks them
// 'escalated', emits an 'escalated' workflow event, and (when the step opts in
// via approver_rule_value.escalate_to_hierarchy) creates a reassign-up task to
// the assignee's hierarchy parent.
//
// SCHEDULING (pg_cron — NOT assumed installed):
//   This function is meant to be invoked on a schedule. Once pg_cron + pg_net
//   are enabled on the project, schedule e.g. every 15 minutes:
//
//     select cron.schedule(
//       'tas-workflow-escalate',
//       '*/15 * * * *',
//       $$ select net.http_post(
//            url     := '<PROJECT_URL>/functions/v1/workflow-escalate',
//            headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
//          ); $$
//     );
//
// NOTE: actual Outlook/Teams notification delivery is M0.4. This function only
// FLAGS overdue tasks and emits events; M0.4 consumes tas_workflow_event.
//
// Secrets (managed by Supabase/Lovable — never hardcode):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST" && req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse("SERVER_MISCONFIGURED", 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();

  try {
    // 1. Overdue, still-pending tasks.
    const { data: overdue, error: findErr } = await admin
      .from("tas_workflow_task")
      .select("id, instance_id, step_no, assignee_user_id, due_at")
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", nowIso);

    if (findErr) throw findErr;

    const tasks = overdue ?? [];
    let escalated = 0;

    for (const task of tasks) {
      // 2. Flag the task as escalated.
      const { error: updErr } = await admin
        .from("tas_workflow_task")
        .update({ status: "escalated", acted_at: nowIso })
        .eq("id", task.id)
        .eq("status", "pending"); // optimistic guard against a concurrent decision
      if (updErr) {
        console.error("[workflow-escalate] update failed for task", task.id, updErr);
        continue;
      }

      // 3. Emit an 'escalated' event (M0.4 will notify from this).
      await admin.from("tas_workflow_event").insert({
        instance_id: task.instance_id,
        event_type: "escalated",
        payload_json: {
          task_id: task.id,
          step_no: task.step_no,
          assignee_user_id: task.assignee_user_id,
          due_at: task.due_at,
        },
      });

      // 4. Append-only history note.
      await admin.from("tas_workflow_history").insert({
        instance_id: task.instance_id,
        step_no: task.step_no,
        actor_user_id: null,
        action: "escalated",
        from_status: "pending",
        to_status: "escalated",
        comment: "SLA breached; escalated by sweep",
      });

      escalated += 1;
    }

    // NOTE: reassign-up to the hierarchy parent is intentionally deferred — it
    // depends on a manager designation on the org tables (see resolve_step_
    // approvers heuristic / M0.3 TODOs). For now the sweep flags + emits events.

    return jsonResponse({ scanned: tasks.length, escalated, at: nowIso });
  } catch (err) {
    console.error("[workflow-escalate] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
