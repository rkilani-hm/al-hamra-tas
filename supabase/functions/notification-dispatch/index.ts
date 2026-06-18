// =============================================================================
// Edge Function: notification-dispatch  (Module M0.4 — Notifications)
// =============================================================================
// The central dispatcher. Runnable on a cron AND best-effort invoked immediately
// after a workflow action. It:
//   1. Expands unconsumed tas_workflow_event rows into tas_notification rows
//      (ALWAYS in_app; plus one queued row per enabled+configured external
//      channel the recipient hasn't opted out of). Idempotent per
//      (source_event_id, recipient, channel).
//   2. Delivers queued rows: in_app -> 'sent' immediately; external -> adapter,
//      which yields 'sent' | 'skipped' (unconfigured) | 'failed'/'failed_terminal'.
//   3. Marks a workflow event consumed once all its notifications are resolved.
//
// Degradation is a feature: a missing/disabled adapter => 'skipped', never a crash.
//
// SCHEDULING (pg_cron — NOT assumed installed). Once pg_cron + pg_net are enabled:
//   select cron.schedule('tas-notification-dispatch', '* * * * *',  -- every minute
//     $$ select net.http_post(
//          url     := '<PROJECT_URL>/functions/v1/notification-dispatch',
//          headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>')
//        ); $$);
//
// Secrets (Supabase/Lovable env; never hardcode): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, and per-adapter secrets documented in adapters.ts.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import { sendViaChannel, UnconfiguredError } from "./adapters.ts";

const MAX_RETRY = 5;
const EXTERNAL_CHANNELS = ["outlook_email", "teams", "sms"] as const;

// deno-lint-ignore no-explicit-any
type Admin = any;

// Deep link per event type.
function deepLink(eventType: string): string {
  return eventType === "task_created" || eventType === "escalated"
    ? "/app/workflow/inbox"
    : "/app/workflow";
}

// Recipients for a workflow event.
async function resolveRecipients(admin: Admin, event: {
  id: string;
  instance_id: string;
  event_type: string;
  payload_json: Record<string, unknown>;
}): Promise<string[]> {
  const et = event.event_type;
  const payload = event.payload_json ?? {};

  if (et === "escalated") {
    const a = payload.assignee_user_id as string | undefined;
    return a ? [a] : [];
  }

  if (et === "task_created") {
    const stepNo = payload.step_no as number | undefined;
    const { data: tasks } = await admin
      .from("tas_workflow_task")
      .select("assignee_user_id")
      .eq("instance_id", event.instance_id)
      .eq("step_no", stepNo ?? -1)
      .eq("status", "pending");
    return [
      ...new Set(
        (tasks ?? [])
          .map((t: { assignee_user_id: string | null }) => t.assignee_user_id)
          .filter(Boolean) as string[],
      ),
    ];
  }

  // step_advanced / instance_completed / rejected / returned / blocked -> requester
  const { data: inst } = await admin
    .from("tas_workflow_instance")
    .select("requester_user_id")
    .eq("id", event.instance_id)
    .maybeSingle();
  return inst?.requester_user_id ? [inst.requester_user_id] : [];
}

// Build the {{var}} context for an instance + step.
async function buildContext(admin: Admin, instanceId: string, stepNo: number | null) {
  const { data: inst } = await admin
    .from("tas_workflow_instance")
    .select("request_type, request_ref, definition_id")
    .eq("id", instanceId)
    .maybeSingle();

  let stepName = "";
  if (inst && stepNo != null) {
    const { data: step } = await admin
      .from("tas_workflow_step")
      .select("name_en, name_ar")
      .eq("definition_id", inst.definition_id)
      .eq("step_no", stepNo)
      .maybeSingle();
    stepName = step?.name_en ?? "";
  }
  return {
    request_type: inst?.request_type ?? "",
    request_ref: inst?.request_ref ?? "",
    step_name: stepName,
  };
}

// Is an external channel enabled for this user? (absence of pref = enabled).
async function prefEnabled(admin: Admin, userId: string, channel: string, category: string) {
  const { data: pref } = await admin
    .from("tas_notification_pref")
    .select("enabled, is_mandatory")
    .eq("user_id", userId)
    .eq("channel", channel)
    .eq("type_category", category)
    .maybeSingle();
  if (!pref) return true; // absence = enabled
  return pref.is_mandatory ? true : pref.enabled;
}

async function render(admin: Admin, typeCode: string, channel: string, locale: string, ctx: unknown) {
  const { data } = await admin.rpc("render_template", {
    p_type_code: typeCode,
    p_channel: channel,
    p_locale: locale,
    p_context: ctx,
  });
  const row = Array.isArray(data) ? data[0] : null;
  return { subject: row?.subject ?? typeCode, body: row?.body ?? "" };
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST" && req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const nowIso = new Date().toISOString();

  try {
    // Which external channels are actually enabled + configured right now.
    const { data: adapters } = await admin
      .from("tas_comm_adapter_config")
      .select("channel, is_enabled, config_status");
    const liveExternal = new Set(
      (adapters ?? [])
        .filter(
          (a: { channel: string; is_enabled: boolean; config_status: string }) =>
            EXTERNAL_CHANNELS.includes(a.channel as never) &&
            a.is_enabled &&
            a.config_status === "configured",
        )
        .map((a: { channel: string }) => a.channel),
    );

    // ---- Phase A: expand unconsumed workflow events into notifications. ----
    const { data: events } = await admin
      .from("tas_workflow_event")
      .select("id, instance_id, event_type, payload_json")
      .eq("consumed", false)
      .order("created_at", { ascending: true })
      .limit(200);

    let created = 0;

    for (const event of events ?? []) {
      const typeCode = `workflow.${event.event_type}`;
      const category = "workflow";
      const stepNo = (event.payload_json?.step_no as number) ?? null;

      const recipients = await resolveRecipients(admin, event);
      const ctx = await buildContext(admin, event.instance_id, stepNo);
      const link = deepLink(event.event_type);

      // Existing notifications for this event -> idempotency set.
      const { data: existing } = await admin
        .from("tas_notification")
        .select("recipient_user_id, channel")
        .eq("source_event_id", event.id);
      const seen = new Set(
        (existing ?? []).map(
          (e: { recipient_user_id: string; channel: string }) =>
            `${e.recipient_user_id}|${e.channel}`,
        ),
      );

      for (const uid of recipients) {
        const { data: usr } = await admin
          .from("tas_user")
          .select("default_locale")
          .eq("id", uid)
          .maybeSingle();
        const locale = usr?.default_locale ?? "en";

        // in_app — ALWAYS (delivered by being read).
        if (!seen.has(`${uid}|in_app`)) {
          const r = await render(admin, typeCode, "in_app", locale, ctx);
          const { error } = await admin.from("tas_notification").insert({
            recipient_user_id: uid,
            type_code: typeCode,
            channel: "in_app",
            locale,
            subject: r.subject,
            body: r.body,
            context_json: ctx,
            deep_link: link,
            source_event_id: event.id,
            status: "queued",
          });
          if (!error) created += 1;
        }

        // external channels — only enabled+configured adapters the user allows.
        for (const ch of EXTERNAL_CHANNELS) {
          if (!liveExternal.has(ch)) continue;
          if (seen.has(`${uid}|${ch}`)) continue;
          if (!(await prefEnabled(admin, uid, ch, category))) continue;
          const r = await render(admin, typeCode, ch, locale, ctx);
          const { error } = await admin.from("tas_notification").insert({
            recipient_user_id: uid,
            type_code: typeCode,
            channel: ch,
            locale,
            subject: r.subject,
            body: r.body,
            context_json: ctx,
            deep_link: link,
            source_event_id: event.id,
            status: "queued",
          });
          if (!error) created += 1;
        }
      }
    }

    // ---- Phase B: deliver queued notifications. ----
    const { data: queued } = await admin
      .from("tas_notification")
      .select("id, channel, recipient_user_id, subject, body, retry_count")
      .eq("status", "queued")
      .limit(500);

    let sent = 0, skipped = 0, failed = 0;

    for (const n of queued ?? []) {
      if (n.channel === "in_app") {
        await admin.from("tas_notification").update({ status: "sent", sent_at: nowIso }).eq("id", n.id);
        sent += 1;
        continue;
      }

      // External: re-check adapter config (could have changed).
      const { data: cfg } = await admin
        .from("tas_comm_adapter_config")
        .select("is_enabled, config_status")
        .eq("channel", n.channel)
        .maybeSingle();
      if (!cfg || !cfg.is_enabled || cfg.config_status !== "configured") {
        await admin
          .from("tas_notification")
          .update({ status: "skipped", error_text: `adapter ${n.channel} disabled/unconfigured` })
          .eq("id", n.id);
        skipped += 1;
        continue;
      }

      const { data: usr } = await admin
        .from("tas_user")
        .select("email")
        .eq("id", n.recipient_user_id)
        .maybeSingle();

      try {
        await sendViaChannel(n.channel, {
          recipientEmail: usr?.email ?? null,
          subject: n.subject ?? "",
          body: n.body ?? "",
        });
        await admin.from("tas_notification").update({ status: "sent", sent_at: nowIso }).eq("id", n.id);
        sent += 1;
      } catch (err) {
        if (err instanceof UnconfiguredError) {
          await admin
            .from("tas_notification")
            .update({ status: "skipped", error_text: err.message })
            .eq("id", n.id);
          skipped += 1;
        } else {
          const retry = (n.retry_count ?? 0) + 1;
          const terminal = retry >= MAX_RETRY;
          await admin
            .from("tas_notification")
            .update({
              status: terminal ? "failed_terminal" : "failed",
              retry_count: retry,
              error_text: String(err),
            })
            .eq("id", n.id);
          failed += 1;
        }
      }
    }

    // ---- Mark events consumed once all their notifications are resolved. ----
    for (const event of events ?? []) {
      const { data: notes } = await admin
        .from("tas_notification")
        .select("status")
        .eq("source_event_id", event.id);
      const resolved = (notes ?? []).every((x: { status: string }) =>
        ["sent", "skipped", "failed_terminal"].includes(x.status),
      );
      if ((notes ?? []).length === 0 || resolved) {
        await admin.from("tas_workflow_event").update({ consumed: true }).eq("id", event.id);
      }
    }

    return jsonResponse({ events: (events ?? []).length, created, sent, skipped, failed, at: nowIso });
  } catch (err) {
    console.error("[notification-dispatch] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
