// =============================================================================
// Edge Function: document-upload  (Module M0.5 — Document Store)
// =============================================================================
// Accepts a file + metadata, routes storage (SharePoint when live, else Supabase
// Storage fallback), records tas_document, and writes an audit entry.
//
// Contract (POST JSON):
//   { file_base64, file_name, mime_type, title?, category?,
//     linked_entity_type?, linked_entity_ref?, supersedes_id?, actor_user_id? }
//   (actor_user_id = the signed-in tas_user; real Entra-JWT-derived caller
//    resolution is a follow-up — see M0.5 TODOs. The bucket fallback works today.)
//
// Storage router: if tas_storage_adapter_config.sharepoint is enabled+configured
// AND its secrets are present -> SharePoint; otherwise transparently use Supabase
// Storage (bucket 'tas-documents'). A missing-secrets UnconfiguredError also falls
// back. Never crashes on missing SharePoint config.
//
// Secrets (Supabase/Lovable env; never hardcode): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, and SharePoint secrets documented in _shared/storage.ts.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  base64ToBytes,
  sharepointIsLive,
  sharepointUpload,
  supabaseStorageUpload,
  UnconfiguredError,
} from "../_shared/storage.ts";

interface UploadPayload {
  file_base64?: string;
  file_name?: string;
  mime_type?: string;
  title?: string;
  category?: string;
  linked_entity_type?: string;
  linked_entity_ref?: string;
  supersedes_id?: string;
  actor_user_id?: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let payload: UploadPayload;
  try {
    payload = (await req.json()) as UploadPayload;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }
  if (!payload.file_base64 || !payload.file_name) {
    return errorResponse("INVALID_PAYLOAD", 400, "file_base64 and file_name are required");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const bytes = base64ToBytes(payload.file_base64);
    const contentType = payload.mime_type ?? "application/octet-stream";

    // Versioning: if replacing, compute next version from the prior row.
    let version = 1;
    if (payload.supersedes_id) {
      const { data: prior } = await admin
        .from("tas_document")
        .select("version")
        .eq("id", payload.supersedes_id)
        .maybeSingle();
      version = (prior?.version ?? 1) + 1;
    }

    // Unique-ish storage path.
    const safeName = payload.file_name.replace(/[^\w.\-]+/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${payload.linked_entity_type ?? "unlinked"}/${payload.linked_entity_ref ?? "general"}/${stamp}_${safeName}`;

    // --- Storage router: SharePoint when live, else Supabase Storage fallback.
    let provider: "sharepoint" | "supabase_storage" = "supabase_storage";
    let storageRef: string;
    if (await sharepointIsLive(admin)) {
      try {
        storageRef = await sharepointUpload(path, bytes, contentType);
        provider = "sharepoint";
      } catch (err) {
        if (err instanceof UnconfiguredError) {
          storageRef = await supabaseStorageUpload(admin, path, bytes, contentType);
        } else {
          throw err;
        }
      }
    } else {
      storageRef = await supabaseStorageUpload(admin, path, bytes, contentType);
    }

    // Record metadata.
    const { data: doc, error: insErr } = await admin
      .from("tas_document")
      .insert({
        title: payload.title ?? payload.file_name,
        category: payload.category ?? "other",
        linked_entity_type: payload.linked_entity_type ?? null,
        linked_entity_ref: payload.linked_entity_ref ?? null,
        storage_provider: provider,
        storage_ref: storageRef,
        file_name: payload.file_name,
        mime_type: contentType,
        size_bytes: bytes.byteLength,
        version,
        supersedes_id: payload.supersedes_id ?? null,
        status: "active",
        uploaded_by: payload.actor_user_id ?? null,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    // Audit.
    await admin.rpc("audit_log", {
      p_actor: payload.actor_user_id ?? null,
      p_module: "M0.5",
      p_event_type: "document.uploaded",
      p_entity_type: payload.linked_entity_type ?? null,
      p_entity_ref: payload.linked_entity_ref ?? null,
      p_detail: { document_id: doc.id, provider, file_name: payload.file_name, version },
    });

    return jsonResponse({ document: doc, provider, version });
  } catch (err) {
    console.error("[document-upload] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
