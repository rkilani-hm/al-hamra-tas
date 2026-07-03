// =============================================================================
// Edge Function: graph-selftest  (O365 / Microsoft Graph diagnostic)
// =============================================================================
// A one-off diagnostic to validate the Entra app registration + secrets +
// permissions WITHOUT touching production data. On POST it:
//   1. reports which Graph secrets are present,
//   2. acquires a client-credentials token (verifies app + secret + tenant),
//   3. sends a test email (Mail.Send) to the target address,
//   4. creates a Teams online meeting event today (Calendars.ReadWrite +
//      OnlineMeetings) inviting the target address.
// Body (optional): { "to": "someone@domain" }  — defaults to rkilani@alhamra.com.kw
// Returns a structured report; never throws. DELETE this function after testing.
// =============================================================================

import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() !== "" ? v : undefined;
}

async function graphToken(): Promise<string> {
  const tenant = env("ENTRA_TENANT_ID");
  const clientId = env("ENTRA_CLIENT_ID");
  const clientSecret = env("ENTRA_CLIENT_SECRET");
  const scopes = env("GRAPH_SCOPES") ?? "https://graph.microsoft.com/.default";
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      scope: scopes,
      grant_type: "client_credentials",
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.access_token) {
    throw new Error(`token ${resp.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json.access_token as string;
}

// Decode the (unverified) JWT payload to inspect the granted app roles.
// deno-lint-ignore no-explicit-any
function decodeToken(token: string): Record<string, any> {
  try {
    const payload = token.split(".")[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(payload.length + (4 - (payload.length % 4)) % 4, "=");
    const json = JSON.parse(atob(b64));
    return { roles: json.roles ?? [], aud: json.aud, appid: json.appid ?? json.azp, tenant: json.tid };
  } catch {
    return { roles: [], decode: "failed" };
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  let to = "rkilani@alhamra.com.kw";
  try {
    const b = await req.json();
    if (b?.to) to = String(b.to);
  } catch { /* use default */ }

  const sender = env("GRAPH_SENDER_UPN");
  const organizer = env("GRAPH_ORGANIZER_UPN") ?? sender;

  // deno-lint-ignore no-explicit-any
  const report: Record<string, any> = {
    to,
    secrets_present: {
      ENTRA_TENANT_ID: !!env("ENTRA_TENANT_ID"),
      ENTRA_CLIENT_ID: !!env("ENTRA_CLIENT_ID"),
      ENTRA_CLIENT_SECRET: !!env("ENTRA_CLIENT_SECRET"),
      GRAPH_SENDER_UPN: !!sender,
      GRAPH_ORGANIZER_UPN: !!env("GRAPH_ORGANIZER_UPN"),
    },
    sender: sender ?? null,
    organizer: organizer ?? null,
  };

  if (!env("ENTRA_TENANT_ID") || !env("ENTRA_CLIENT_ID") || !env("ENTRA_CLIENT_SECRET")) {
    report.token = "skipped — ENTRA_* secret(s) missing";
    return jsonResponse(report);
  }

  let token: string;
  try {
    token = await graphToken();
    report.token = "ok";
    report.token_claims = decodeToken(token);
  } catch (err) {
    report.token = "failed";
    report.token_error = String(err);
    return jsonResponse(report);
  }

  // 1) Test email via Mail.Send.
  if (!sender) {
    report.email = { skipped: "GRAPH_SENDER_UPN missing" };
  } else {
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: "Al Hamra TAS — test email",
          body: { contentType: "Text", content: "This is a test email from Al Hamra TAS confirming Microsoft Graph (Outlook email) is working." },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    report.email = { ok: r.ok, status: r.status };
    if (!r.ok) report.email.detail = (await r.text()).slice(0, 500);
  }

  // 2) Test Teams meeting via a calendar event today (Graph emails the invite).
  if (!organizer) {
    report.meeting = { skipped: "GRAPH_ORGANIZER_UPN/SENDER missing" };
  } else {
    const start = new Date(Date.now() + 60 * 60 * 1000);        // +1h from now (today)
    const end = new Date(start.getTime() + 30 * 60 * 1000);      // 30 min
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizer)}/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        subject: "Al Hamra TAS — test interview meeting",
        body: { contentType: "HTML", content: "<p>Test Teams meeting from Al Hamra TAS confirming calendar + Teams online meeting creation.</p>" },
        start: { dateTime: start.toISOString().slice(0, 19), timeZone: "UTC" },
        end: { dateTime: end.toISOString().slice(0, 19), timeZone: "UTC" },
        attendees: [{ emailAddress: { address: to }, type: "required" }],
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      }),
    });
    if (r.ok) {
      const j = await r.json();
      report.meeting = { ok: true, event_id: j.id, teams_join_url: j.onlineMeeting?.joinUrl ?? null, web_link: j.webLink ?? null, start_utc: start.toISOString() };
    } else {
      report.meeting = { ok: false, status: r.status, detail: (await r.text()).slice(0, 500) };
    }
  }

  return jsonResponse(report);
});
