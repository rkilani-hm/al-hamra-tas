// =============================================================================
// Edge Function: careers-upload  (Module M2.7 — Website intake, Phase 1)
// =============================================================================
// Public (anon) résumé upload for the careers portal. Validates type + size and
// stores the file in the private tas-documents bucket (service role, server-side)
// under careers/{uuid}.{ext}. Returns a storage_ref; never exposes the key, never
// allows public read. Safe-by-default: rejects anything not PDF/DOC/DOCX or > 5 MB.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import { base64ToBytes, DOCUMENTS_BUCKET } from "../_shared/storage.ts";

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAX_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let contentType = "", dataB64 = "";
  try {
    const b = await req.json();
    contentType = String(b?.content_type ?? "");
    dataB64 = String(b?.data_base64 ?? "");
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }

  const ext = EXT[contentType];
  if (!ext) return jsonResponse({ ok: false, error: "unsupported_type" });

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(dataB64);
  } catch {
    return jsonResponse({ ok: false, error: "bad_data" });
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return jsonResponse({ ok: false, error: "size" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const path = `careers/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(DOCUMENTS_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) {
    console.error("[careers-upload] upload failed:", error.message);
    return jsonResponse({ ok: false, error: "upload_failed" });
  }
  return jsonResponse({ ok: true, resume_ref: path });
});
