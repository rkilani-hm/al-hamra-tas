// Module M0.5 — Documents: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include tas_document,
// tas_storage_adapter_config, and the document RPCs after the M0.5 migrations
// were applied). Categories read the existing tas_lookup table.
//
// Uploads/downloads call the document-upload / document-download edge functions,
// which run the SharePoint→Supabase-Storage router server-side.

import { supabase } from "@/integrations/supabase/client";
import type {
  DocumentCategoryOption,
  DocumentRow,
  DocumentVersion,
  StorageAdapterConfig,
  UploadInput,
} from "./types";

// --- Reads (RPC + tables) ---------------------------------------------------

export async function listDocuments(
  entityType: string | null,
  entityRef: string | null,
): Promise<DocumentRow[]> {
  // list_documents' args are typed as required strings, but the SQL treats null
  // as "ignore this filter" — cast the nullable values through.
  const { data, error } = await supabase.rpc("list_documents", {
    p_entity_type: (entityType ?? null) as unknown as string,
    p_entity_ref: (entityRef ?? null) as unknown as string,
  });
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function documentVersions(id: string): Promise<DocumentVersion[]> {
  const { data, error } = await supabase.rpc("document_versions", { p_id: id });
  if (error) throw error;
  return (data ?? []) as DocumentVersion[];
}

export async function listStorageAdapters(): Promise<StorageAdapterConfig[]> {
  const { data, error } = await supabase
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
  const { error } = await supabase.rpc("archive_document", { p_id: id });
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
