// Module M0.5 — Documents: data-access layer.
//
// INTERIM (same pattern as prior modules): tas_document, tas_storage_adapter_config
// and the document RPCs are not in the generated Database type until Lovable
// applies this module's migrations on sync. Until then those go through a loosely-
// typed view of the client (`db`). The category list reads the EXISTING tas_lookup
// table via the strict typed `supabase` client. Follow-up: swap `db` -> strict
// `supabase` (and delete the alias) after the M0.5 migrations apply.
//
// Uploads/downloads call the document-upload / document-download edge functions,
// which run the SharePoint→Supabase-Storage router server-side.

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  DocumentCategoryOption,
  DocumentRow,
  DocumentVersion,
  StorageAdapterConfig,
  UploadInput,
} from "./types";

const db = supabase as unknown as SupabaseClient;

// --- Reads (RPC + tables) ---------------------------------------------------

export async function listDocuments(
  entityType: string | null,
  entityRef: string | null,
): Promise<DocumentRow[]> {
  const { data, error } = await db.rpc("list_documents", {
    p_entity_type: entityType,
    p_entity_ref: entityRef,
  });
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function documentVersions(id: string): Promise<DocumentVersion[]> {
  const { data, error } = await db.rpc("document_versions", { p_id: id });
  if (error) throw error;
  return (data ?? []) as DocumentVersion[];
}

export async function listStorageAdapters(): Promise<StorageAdapterConfig[]> {
  const { data, error } = await db
    .from("tas_storage_adapter_config")
    .select("id, provider, is_enabled, config_status, notes")
    .order("provider");
  if (error) throw error;
  return (data ?? []) as StorageAdapterConfig[];
}

// Categories come from the EXISTING tas_lookup table (strict typed client).
export async function listCategories(): Promise<DocumentCategoryOption[]> {
  const { data, error } = await supabase
    .from("tas_lookup")
    .select("code, name_en, name_ar, sort_order")
    .eq("lookup_type", "document_category")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DocumentCategoryOption[];
}

// --- Writes -----------------------------------------------------------------

// Archive (soft-delete) via RPC (self-resolves caller + audits).
export async function archiveDocument(id: string): Promise<void> {
  const { error } = await db.rpc("archive_document", { p_id: id });
  if (error) throw error;
}

// Upload through the edge function (storage router runs server-side).
export async function uploadDocument(input: UploadInput): Promise<{ document: DocumentRow; provider: string }> {
  const { data, error } = await supabase.functions.invoke("document-upload", { body: input });
  if (error) throw error;
  return data as { document: DocumentRow; provider: string };
}

// Resolve a time-limited download URL through the edge function.
export async function downloadDocument(
  documentId: string,
  actorUserId?: string | null,
): Promise<{ url: string; file_name: string | null }> {
  const { data, error } = await supabase.functions.invoke("document-download", {
    body: { document_id: documentId, actor_user_id: actorUserId ?? null },
  });
  if (error) throw error;
  return data as { url: string; file_name: string | null };
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[documents] query failed (showing empty):", err);
      return [];
    }
  };
}
