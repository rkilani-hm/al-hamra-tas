// =============================================================================
// M0.5 — Storage adapters shared by document-upload / document-download.
// =============================================================================
// SharePoint (Microsoft Graph) is the preferred provider but DORMANT until its
// secrets exist — its functions throw `UnconfiguredError`, which the router turns
// into a transparent fallback to Supabase Storage (bucket 'tas-documents').
// Supabase Storage is always available. Degradation is a feature; never crash.
//
// Required secrets (Supabase/Lovable env; never hardcode):
//   SharePoint: ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET,
//               GRAPH_SCOPES, SHAREPOINT_SITE_ID, SHAREPOINT_DRIVE_ID
//   Supabase Storage: uses the service-role client (no extra secrets).
// =============================================================================

export const DOCUMENTS_BUCKET = "tas-documents";

export class UnconfiguredError extends Error {
  constructor(provider: string, detail: string) {
    super(`storage '${provider}' unconfigured: ${detail}`);
    this.name = "UnconfiguredError";
  }
}

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() !== "" ? v : undefined;
}

// Decode a base64 payload into bytes.
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64; // strip data: prefix
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// --- Microsoft Graph (SharePoint) -------------------------------------------
async function graphToken(): Promise<string> {
  const tenant = env("ENTRA_TENANT_ID");
  const clientId = env("ENTRA_CLIENT_ID");
  const clientSecret = env("ENTRA_CLIENT_SECRET");
  const scopes = env("GRAPH_SCOPES") ?? "https://graph.microsoft.com/.default";
  if (!tenant || !clientId || !clientSecret) {
    throw new UnconfiguredError("sharepoint", "ENTRA_TENANT_ID/CLIENT_ID/CLIENT_SECRET missing");
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
  if (!resp.ok) throw new Error(`graph token request failed: ${resp.status}`);
  const json = await resp.json();
  if (!json.access_token) throw new Error("graph token response missing access_token");
  return json.access_token as string;
}

function sharepointTarget() {
  const siteId = env("SHAREPOINT_SITE_ID");
  const driveId = env("SHAREPOINT_DRIVE_ID");
  if (!siteId || !driveId) {
    throw new UnconfiguredError("sharepoint", "SHAREPOINT_SITE_ID/SHAREPOINT_DRIVE_ID missing");
  }
  return { siteId, driveId };
}

// Upload to SharePoint; returns the Graph driveItem id as storage_ref.
export async function sharepointUpload(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { driveId } = sharepointTarget();
  const token = await graphToken(); // throws UnconfiguredError if creds missing
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeURI(path)}:/content`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: bytes,
    },
  );
  if (!resp.ok) throw new Error(`SharePoint upload failed: ${resp.status} ${await resp.text()}`);
  const item = await resp.json();
  return item.id as string;
}

// Create a SharePoint download/sharing URL for a drive item id.
export async function sharepointDownloadUrl(driveItemId: string): Promise<string> {
  const { driveId } = sharepointTarget();
  const token = await graphToken();
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${driveItemId}?select=@microsoft.graph.downloadUrl`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) throw new Error(`SharePoint download link failed: ${resp.status}`);
  const item = await resp.json();
  const url = item["@microsoft.graph.downloadUrl"];
  if (!url) throw new Error("SharePoint item has no download URL");
  return url as string;
}

// --- Supabase Storage (always-available fallback) ---------------------------
// deno-lint-ignore no-explicit-any
export async function supabaseStorageUpload(admin: any, path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
  return path; // storage_ref = bucket path
}

// deno-lint-ignore no-explicit-any
export async function supabaseStorageDownloadUrl(admin: any, path: string): Promise<string> {
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 3600); // 1 hour
  if (error) throw new Error(`Supabase Storage signed URL failed: ${error.message}`);
  return data.signedUrl as string;
}

// Is SharePoint marked enabled+configured in the adapter config table?
// deno-lint-ignore no-explicit-any
export async function sharepointIsLive(admin: any): Promise<boolean> {
  const { data } = await admin
    .from("tas_storage_adapter_config")
    .select("is_enabled, config_status")
    .eq("provider", "sharepoint")
    .maybeSingle();
  return Boolean(data?.is_enabled && data?.config_status === "configured");
}
