// =============================================================================
// M0.4 — Pluggable communication adapters for the notification dispatcher.
// =============================================================================
// Each adapter is GUARDED: if its required secrets/config are absent it throws
// `UnconfiguredError`, which the dispatcher turns into status 'skipped' (NOT
// 'failed', never a crash). When configured, the adapter performs the real send;
// any runtime error propagates as a normal Error -> the dispatcher marks 'failed'
// (and 'failed_terminal' after MAX retries).
//
// Required secrets (set in Supabase/Lovable env — never hardcode):
//   Outlook email + Teams (Microsoft Graph, client-credentials):
//     ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, GRAPH_SCOPES
//   SMS:
//     SMS_GATEWAY_URL, SMS_GATEWAY_KEY
// =============================================================================

export class UnconfiguredError extends Error {
  constructor(channel: string, detail: string) {
    super(`adapter '${channel}' unconfigured: ${detail}`);
    this.name = "UnconfiguredError";
  }
}

export interface OutboundMessage {
  recipientEmail?: string | null;
  recipientName?: string | null;
  subject: string;
  body: string;
}

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() !== "" ? v : undefined;
}

// Microsoft Graph client-credentials token (shared by email + Teams).
async function graphToken(): Promise<string> {
  const tenant = env("ENTRA_TENANT_ID");
  const clientId = env("ENTRA_CLIENT_ID");
  const clientSecret = env("ENTRA_CLIENT_SECRET");
  const scopes = env("GRAPH_SCOPES") ?? "https://graph.microsoft.com/.default";
  if (!tenant || !clientId || !clientSecret) {
    throw new UnconfiguredError("graph", "ENTRA_TENANT_ID/CLIENT_ID/CLIENT_SECRET missing");
  }

  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: scopes,
      grant_type: "client_credentials",
    }),
  });
  if (!resp.ok) {
    throw new Error(`graph token request failed: ${resp.status}`);
  }
  const json = await resp.json();
  if (!json.access_token) throw new Error("graph token response missing access_token");
  return json.access_token as string;
}

// --- Outlook email via Graph Mail.Send --------------------------------------
export async function sendOutlookEmail(msg: OutboundMessage): Promise<void> {
  if (!msg.recipientEmail) {
    throw new UnconfiguredError("outlook_email", "recipient has no email address");
  }
  const sender = env("GRAPH_SENDER_UPN"); // mailbox to send as
  if (!sender) {
    throw new UnconfiguredError("outlook_email", "GRAPH_SENDER_UPN missing");
  }
  const token = await graphToken(); // throws UnconfiguredError if creds missing

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: msg.subject,
          body: { contentType: "Text", content: msg.body },
          toRecipients: [{ emailAddress: { address: msg.recipientEmail } }],
        },
        saveToSentItems: false,
      }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Graph sendMail failed: ${resp.status} ${await resp.text()}`);
  }
}

// --- Teams via Graph (placeholder: requires a chat/channel target) ----------
export async function sendTeamsMessage(msg: OutboundMessage): Promise<void> {
  // A real send needs a resolved chat/channel id per recipient, which is not
  // modeled yet. Guard on creds first so this no-ops as 'skipped' until both the
  // Graph credentials AND a target-resolution strategy exist (M0.4+/ops).
  await graphToken(); // throws UnconfiguredError if creds missing
  throw new UnconfiguredError("teams", "Teams chat/channel target resolution not configured");
}

// --- SMS via a generic HTTP gateway -----------------------------------------
export async function sendSms(msg: OutboundMessage & { recipientPhone?: string | null }): Promise<void> {
  const url = env("SMS_GATEWAY_URL");
  const key = env("SMS_GATEWAY_KEY");
  if (!url || !key) {
    throw new UnconfiguredError("sms", "SMS_GATEWAY_URL/SMS_GATEWAY_KEY missing");
  }
  if (!msg.recipientPhone) {
    throw new UnconfiguredError("sms", "recipient has no phone number");
  }
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: msg.recipientPhone, text: `${msg.subject}\n${msg.body}` }),
  });
  if (!resp.ok) {
    throw new Error(`SMS gateway failed: ${resp.status}`);
  }
}

// Dispatch by channel. Returns nothing on success; throws UnconfiguredError or Error.
export async function sendViaChannel(channel: string, msg: OutboundMessage): Promise<void> {
  switch (channel) {
    case "outlook_email":
      return await sendOutlookEmail(msg);
    case "teams":
      return await sendTeamsMessage(msg);
    case "sms":
      return await sendSms(msg);
    default:
      throw new UnconfiguredError(channel, "no adapter for channel");
  }
}
