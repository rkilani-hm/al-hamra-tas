// =============================================================================
// Edge Function: interview-schedule  (Module M1.7 — Interview Management)
// =============================================================================
// The DORMANT Microsoft Graph scheduling adapter for interviews. Best-effort
// invoked (fire-and-forget) by the frontend AFTER schedule_interview /
// reschedule_interview return. In-app scheduling works regardless of this
// function; it only adds an Outlook calendar event + Teams meeting WHEN M365 is
// configured.
//
// Behavior (degradation is a feature — never crash):
//   * Read tas_comm_adapter_config. If neither 'outlook_email' nor 'teams' is
//     is_enabled + config_status='configured', OR the Graph secrets are absent,
//     set tas_interview.calendar_status='skipped' and return — NOT 'failed'.
//   * If configured + secrets present: create the Outlook event (+ Teams online
//     meeting when mode='teams'), store outlook_event_id + teams_join_url, set
//     calendar_status='created'.
//   * On any Graph error: set calendar_status='failed' + a note; return 200.
//
// Required secrets (Supabase/Lovable env; NEVER hardcode) — all already part of
// the Entra/Graph family used elsewhere; none are added by M1.7:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET
//   GRAPH_SCOPES  — must include Calendars.ReadWrite and OnlineMeetings.ReadWrite
//                   (and an organizer mailbox the app may write to).
//
// Adapter-config flags read: tas_comm_adapter_config.channel in
// ('outlook_email','teams') -> is_enabled + config_status.
//
// NOTE: actual Graph calls are DORMANT until Al Hamra provisions the scopes. The
// createOutlookEvent/createTeamsMeeting helpers below throw UnconfiguredError
// when secrets are missing, which the handler maps to 'skipped'.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

class UnconfiguredError extends Error {}

interface GraphSecrets {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
}

// Read Graph secrets; throw UnconfiguredError if any is missing (dormant state).
function readGraphSecrets(): GraphSecrets {
  const tenantId = Deno.env.get("ENTRA_TENANT_ID") ?? "";
  const clientId = Deno.env.get("ENTRA_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("ENTRA_CLIENT_SECRET") ?? "";
  const scopes = Deno.env.get("GRAPH_SCOPES") ?? "";
  if (!tenantId || !clientId || !clientSecret) {
    throw new UnconfiguredError("Graph credentials (ENTRA_*) are not configured.");
  }
  return { tenantId, clientId, clientSecret, scopes };
}

interface InterviewRow {
  id: string;
  reference: string | null;
  scheduled_at: string | null;
  duration_min: number;
  mode: string;
  location: string | null;
}

// DORMANT: create an Outlook calendar event via Graph. Throws until configured.
// When Al Hamra provisions Calendars.ReadWrite, implement the POST to
// /users/{organizer}/events here and return the created event id.
async function createOutlookEvent(_secrets: GraphSecrets, _iv: InterviewRow): Promise<string> {
  // Intentionally not implemented until scopes exist. Reaching here means secrets
  // were present; absence is handled earlier via UnconfiguredError.
  await Promise.resolve();
  throw new UnconfiguredError("Outlook event creation is dormant until Graph scopes are provisioned.");
}

// DORMANT: create a Teams online meeting via Graph. Throws until configured.
async function createTeamsMeeting(_secrets: GraphSecrets, _iv: InterviewRow): Promise<string> {
  await Promise.resolve();
  throw new UnconfiguredError("Teams meeting creation is dormant until Graph scopes are provisioned.");
}

async function adapterLive(admin: Admin): Promise<boolean> {
  const { data } = await admin
    .from("tas_comm_adapter_config")
    .select("channel, is_enabled, config_status")
    .in("channel", ["outlook_email", "teams"]);
  return (data ?? []).some(
    (a: { is_enabled: boolean; config_status: string }) =>
      a.is_enabled && a.config_status === "configured",
  );
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let interviewId: string | null = null;
  try {
    const body = await req.json();
    interviewId = (body?.interview_id ?? body?.id ?? null) as string | null;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }
  if (!interviewId) return errorResponse("INVALID_PAYLOAD", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: iv } = await admin
      .from("tas_interview")
      .select("id, reference, scheduled_at, duration_min, mode, location")
      .eq("id", interviewId)
      .maybeSingle();
    if (!iv) return errorResponse("INVALID_PAYLOAD", 404);

    // Adapter not live -> skipped (the default state today). Never 'failed'.
    if (!(await adapterLive(admin))) {
      await admin.from("tas_interview").update({ calendar_status: "skipped" }).eq("id", interviewId);
      return jsonResponse({ interview_id: interviewId, calendar_status: "skipped" });
    }

    try {
      const secrets = readGraphSecrets();
      const eventId = await createOutlookEvent(secrets, iv as InterviewRow);
      let joinUrl: string | null = null;
      if (iv.mode === "teams") {
        joinUrl = await createTeamsMeeting(secrets, iv as InterviewRow);
      }
      await admin
        .from("tas_interview")
        .update({ calendar_status: "created", outlook_event_id: eventId, teams_join_url: joinUrl })
        .eq("id", interviewId);
      return jsonResponse({ interview_id: interviewId, calendar_status: "created" });
    } catch (err) {
      // Unconfigured -> skipped; any other Graph error -> failed (+ note). No crash.
      if (err instanceof UnconfiguredError) {
        await admin.from("tas_interview").update({ calendar_status: "skipped" }).eq("id", interviewId);
        return jsonResponse({ interview_id: interviewId, calendar_status: "skipped", note: err.message });
      }
      await admin
        .from("tas_interview")
        .update({ calendar_status: "failed" })
        .eq("id", interviewId);
      return jsonResponse({ interview_id: interviewId, calendar_status: "failed", note: String(err) });
    }
  } catch (err) {
    console.error("[interview-schedule] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
