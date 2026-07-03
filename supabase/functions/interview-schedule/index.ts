// =============================================================================
// Edge Function: interview-schedule  (Module M1.7 — Interview Management)
// =============================================================================
// The Microsoft Graph scheduling adapter for interviews. Best-effort invoked
// (fire-and-forget) by the frontend AFTER schedule_interview / reschedule_interview
// return. In-app scheduling works regardless of this function; it only ADDS an
// Outlook calendar event (+ a Teams online meeting when mode='teams') and sends
// the calendar invite to the candidate + panellists WHEN M365 is configured.
//
// Behavior (degradation is a feature — never crash):
//   * Read tas_comm_adapter_config. If neither 'outlook_email' nor 'teams' is
//     is_enabled + config_status='configured', OR the Graph secrets/organizer are
//     absent, set tas_interview.calendar_status='skipped' and return — NOT 'failed'.
//   * If configured + secrets present: create the Outlook event on the organizer
//     mailbox with the candidate + panellists as attendees (Graph emails them the
//     calendar invite). When mode='teams', the event is created as an online
//     meeting and Graph returns the Teams join URL. Store outlook_event_id +
//     teams_join_url, set calendar_status='created'.
//   * On any Graph error: set calendar_status='failed' + a note; return 200.
//
// Required secrets (Supabase/Lovable env; NEVER hardcode):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET
//   GRAPH_SCOPES        — optional; defaults to https://graph.microsoft.com/.default
//   GRAPH_ORGANIZER_UPN — the mailbox the event is created on (falls back to
//                         GRAPH_SENDER_UPN). The app needs Calendars.ReadWrite on it
//                         (and OnlineMeetings.ReadWrite.All for the Teams meeting).
//
// Adapter-config flags read: tas_comm_adapter_config.channel in
// ('outlook_email','teams') -> is_enabled + config_status.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

const GRAPH = "https://graph.microsoft.com/v1.0";

class UnconfiguredError extends Error {}

interface GraphSecrets {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  organizer: string;
}

// Read Graph secrets; throw UnconfiguredError if any is missing (dormant state).
function readGraphSecrets(): GraphSecrets {
  const tenantId = Deno.env.get("ENTRA_TENANT_ID") ?? "";
  const clientId = Deno.env.get("ENTRA_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("ENTRA_CLIENT_SECRET") ?? "";
  const scopes = Deno.env.get("GRAPH_SCOPES") ?? "https://graph.microsoft.com/.default";
  const organizer = Deno.env.get("GRAPH_ORGANIZER_UPN") ?? Deno.env.get("GRAPH_SENDER_UPN") ?? "";
  if (!tenantId || !clientId || !clientSecret) {
    throw new UnconfiguredError("Graph credentials (ENTRA_*) are not configured.");
  }
  if (!organizer) {
    throw new UnconfiguredError("GRAPH_ORGANIZER_UPN / GRAPH_SENDER_UPN is not configured.");
  }
  return { tenantId, clientId, clientSecret, scopes, organizer };
}

interface InterviewRow {
  id: string;
  reference: string | null;
  application_id: string;
  round_type: string | null;
  scheduled_at: string | null;
  duration_min: number;
  mode: string;
  location: string | null;
  room_email: string | null;
  room_name: string | null;
}

interface Attendee {
  emailAddress: { address: string; name?: string };
  type: "required" | "resource";
}

// Microsoft Graph client-credentials token.
async function graphToken(s: GraphSecrets): Promise<string> {
  const resp = await fetch(`https://login.microsoftonline.com/${s.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.clientId,
      client_secret: s.clientSecret,
      scope: s.scopes,
      grant_type: "client_credentials",
    }),
  });
  if (!resp.ok) throw new Error(`graph token request failed: ${resp.status}`);
  const json = await resp.json();
  if (!json.access_token) throw new Error("graph token response missing access_token");
  return json.access_token as string;
}

// Resolve the candidate + panellists into Graph attendees (those with an email).
async function buildAttendees(
  admin: Admin,
  iv: InterviewRow,
): Promise<{ candidateName: string | null; attendees: Attendee[] }> {
  const attendees: Attendee[] = [];
  let candidateName: string | null = null;

  const { data: app } = await admin
    .from("tas_application")
    .select("candidate_id")
    .eq("id", iv.application_id)
    .maybeSingle();
  if (app?.candidate_id) {
    const { data: cand } = await admin
      .from("tas_candidate")
      .select("full_name_en, full_name_ar, email")
      .eq("id", app.candidate_id)
      .maybeSingle();
    if (cand) {
      candidateName = cand.full_name_en ?? cand.full_name_ar ?? null;
      if (cand.email) {
        attendees.push({ emailAddress: { address: cand.email, name: candidateName ?? undefined }, type: "required" });
      }
    }
  }

  const { data: panel } = await admin
    .from("tas_interview_panelist")
    .select("user_id")
    .eq("interview_id", iv.id);
  const ids = (panel ?? []).map((p: { user_id: string }) => p.user_id);
  if (ids.length > 0) {
    const { data: users } = await admin
      .from("tas_user")
      .select("email, display_name_en, display_name_ar")
      .in("id", ids);
    for (const u of users ?? []) {
      if (u.email) {
        attendees.push({
          emailAddress: { address: u.email, name: u.display_name_en ?? u.display_name_ar ?? undefined },
          type: "required",
        });
      }
    }
  }

  return { candidateName, attendees };
}

// Create the Outlook calendar event (+ Teams online meeting when mode='teams') on
// the organizer mailbox. Graph sends the invite to attendees. Returns the event id
// and, for Teams mode, the join URL.
async function createOutlookEvent(
  secrets: GraphSecrets,
  admin: Admin,
  iv: InterviewRow,
): Promise<{ eventId: string; joinUrl: string | null; webLink: string | null }> {
  if (!iv.scheduled_at) {
    throw new UnconfiguredError("interview has no scheduled_at; nothing to place on the calendar.");
  }
  const token = await graphToken(secrets);
  const { candidateName, attendees } = await buildAttendees(admin, iv);

  const start = new Date(iv.scheduled_at);
  const end = new Date(start.getTime() + (iv.duration_min || 60) * 60_000);
  const isTeams = iv.mode === "teams";
  // In-person + a chosen M365 room -> invite the room mailbox as a resource so
  // Exchange books it, and use the room name as the event location.
  const roomEmail = !isTeams ? (iv.room_email ?? null) : null;
  const locationName = roomEmail ? (iv.room_name ?? iv.location) : iv.location;
  if (roomEmail) {
    attendees.push({ emailAddress: { address: roomEmail, name: iv.room_name ?? undefined }, type: "resource" });
  }

  const subject = `Interview${candidateName ? ` – ${candidateName}` : ""}${iv.reference ? ` (${iv.reference})` : ""}`;
  const lines = [
    candidateName ? `Candidate: ${candidateName}` : null,
    iv.round_type ? `Round: ${iv.round_type}` : null,
    isTeams ? "Mode: Microsoft Teams (online)" : iv.mode === "phone" ? "Mode: Phone" : "Mode: On-site",
    !isTeams && locationName ? `Location: ${locationName}` : null,
    iv.reference ? `Reference: ${iv.reference}` : null,
  ].filter(Boolean);

  // deno-lint-ignore no-explicit-any
  const event: Record<string, any> = {
    subject,
    body: { contentType: "HTML", content: `<p>${lines.join("<br/>")}</p>` },
    start: { dateTime: start.toISOString().slice(0, 19), timeZone: "UTC" },
    end: { dateTime: end.toISOString().slice(0, 19), timeZone: "UTC" },
    attendees,
  };
  if (isTeams) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  } else if (locationName) {
    event.location = { displayName: locationName };
  }

  const resp = await fetch(`${GRAPH}/users/${encodeURIComponent(secrets.organizer)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!resp.ok) {
    throw new Error(`Graph create event failed: ${resp.status} ${await resp.text()}`);
  }
  const created = await resp.json();
  const webLink = created?.webLink ?? null;
  let joinUrl = created?.onlineMeeting?.joinUrl ?? null;

  // The create response omits onlineMeeting even when created — re-fetch for the
  // Teams join URL when this is an online meeting.
  if (isTeams && !joinUrl) {
    try {
      const g = await fetch(
        `${GRAPH}/users/${encodeURIComponent(secrets.organizer)}/events/${created.id}?$select=onlineMeeting`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (g.ok) {
        const ev = await g.json();
        joinUrl = ev?.onlineMeeting?.joinUrl ?? null;
      }
    } catch { /* best-effort */ }
  }

  return { eventId: created.id as string, joinUrl, webLink };
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
      .select("id, reference, application_id, round_type, scheduled_at, duration_min, mode, location, room_email, room_name")
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
      const { eventId, joinUrl, webLink } = await createOutlookEvent(secrets, admin, iv as InterviewRow);
      await admin
        .from("tas_interview")
        .update({ calendar_status: "created", outlook_event_id: eventId, teams_join_url: joinUrl, outlook_web_link: webLink })
        .eq("id", interviewId);
      return jsonResponse({ interview_id: interviewId, calendar_status: "created", teams_join_url: joinUrl, outlook_web_link: webLink });
    } catch (err) {
      // Unconfigured -> skipped; any other Graph error -> failed (+ note). No crash.
      if (err instanceof UnconfiguredError) {
        await admin.from("tas_interview").update({ calendar_status: "skipped" }).eq("id", interviewId);
        return jsonResponse({ interview_id: interviewId, calendar_status: "skipped", note: err.message });
      }
      await admin.from("tas_interview").update({ calendar_status: "failed" }).eq("id", interviewId);
      return jsonResponse({ interview_id: interviewId, calendar_status: "failed", note: String(err) });
    }
  } catch (err) {
    console.error("[interview-schedule] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
