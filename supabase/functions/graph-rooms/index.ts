// =============================================================================
// Edge Function: graph-rooms  (Module M2.6 — Interview room booking)
// =============================================================================
// Lists the tenant's Microsoft 365 room mailboxes (via Graph /places) so the
// recruiter can pick a room for an in-person interview. DORMANT until the Entra/
// Graph secrets are set; returns { dormant:true, rooms:[] } until then. Requires
// the app to hold Place.Read.All (application). Never throws.
// Response: { rooms: [{ name, email, capacity }] } (sorted by name).
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
  if (!resp.ok || !json.access_token) throw new Error(`token ${resp.status}`);
  return json.access_token as string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST" && req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", 405);

  if (!env("ENTRA_TENANT_ID") || !env("ENTRA_CLIENT_ID") || !env("ENTRA_CLIENT_SECRET")) {
    return jsonResponse({ dormant: true, rooms: [], message: "Microsoft 365 is not configured." });
  }

  try {
    const token = await graphToken();
    const resp = await fetch("https://graph.microsoft.com/v1.0/places/microsoft.graph.room?$top=200", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      return jsonResponse({ dormant: false, rooms: [], message: `graph_error_${resp.status}`, detail: (await resp.text()).slice(0, 300) });
    }
    const data = await resp.json();
    // deno-lint-ignore no-explicit-any
    const rooms = ((data?.value ?? []) as any[])
      .map((r) => ({ name: r.displayName ?? r.emailAddress ?? "Room", email: r.emailAddress ?? "", capacity: r.capacity ?? null }))
      .filter((r) => r.email)
      .sort((a, b) => a.name.localeCompare(b.name));
    return jsonResponse({ dormant: false, rooms });
  } catch (err) {
    return jsonResponse({ dormant: false, rooms: [], message: "ai_error", error: String(err).slice(0, 300) });
  }
});
