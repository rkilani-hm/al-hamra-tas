// =============================================================================
// Edge Function: document-download  (Module M0.5 — Document Store)
// =============================================================================
// Given a tas_document id, returns a time-limited download URL routed by the
// document's storage_provider:
//   supabase_storage -> a signed URL (1h) for the 'tas-documents' bucket.
//   sharepoint       -> a Graph download URL.
// Writes a 'document.downloaded' audit entry.
//
// Contract (POST JSON): { document_id, actor_user_id? }
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ SharePoint secrets in
// _shared/storage.ts). Never hardcode.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  sharepointDownloadUrl,
  supabaseStorageDownloadUrl,
} from "../_shared/storage.ts";

interface DownloadPayload {
  document_id?: string;
  actor_user_id?: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let payload: DownloadPayload;
  try {
    payload = (await req.json()) as DownloadPayload;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }
  if (!payload.document_id) {
    return errorResponse("INVALID_PAYLOAD", 400, "document_id is required");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: doc, error } = await admin
      .from("tas_document")
      .select("id, storage_provider, storage_ref, file_name, linked_entity_type, linked_entity_ref")
      .eq("id", payload.document_id)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return errorResponse("INVALID_PAYLOAD", 404, "document not found");

    let url: string;
    if (doc.storage_provider === "sharepoint") {
      url = await sharepointDownloadUrl(doc.storage_ref);
    } else {
      url = await supabaseStorageDownloadUrl(admin, doc.storage_ref);
    }

    await admin.rpc("audit_log", {
      p_actor: payload.actor_user_id ?? null,
      p_module: "M0.5",
      p_event_type: "document.downloaded",
      p_entity_type: doc.linked_entity_type ?? null,
      p_entity_ref: doc.linked_entity_ref ?? null,
      p_detail: { document_id: doc.id, provider: doc.storage_provider, file_name: doc.file_name },
    });

    return jsonResponse({ url, file_name: doc.file_name });
  } catch (err) {
    console.error("[document-download] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
