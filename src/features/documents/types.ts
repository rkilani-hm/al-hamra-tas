// Module M0.5 — Documents: TypeScript types. Mirrors tas_document + RPC shapes.

export type DocumentCategory =
  | "cv"
  | "certificate"
  | "civil_id"
  | "passport"
  | "visa_residency"
  | "offer_letter"
  | "other";
export type StorageProvider = "sharepoint" | "supabase_storage";
export type DocumentStatus = "active" | "archived";
export type AdapterConfigStatus = "unconfigured" | "configured";

// list_documents() row
export interface DocumentRow {
  id: string;
  title: string | null;
  category: string | null;
  linked_entity_type: string | null;
  linked_entity_ref: string | null;
  storage_provider: StorageProvider;
  storage_ref: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  supersedes_id: string | null;
  status: DocumentStatus;
  uploaded_by: string | null;
  created_at: string;
}

// document_versions() row
export interface DocumentVersion {
  id: string;
  title: string | null;
  version: number;
  supersedes_id: string | null;
  status: DocumentStatus;
  file_name: string | null;
  created_at: string;
}

export interface StorageAdapterConfig {
  id: string;
  provider: StorageProvider;
  is_enabled: boolean;
  config_status: AdapterConfigStatus;
  notes: string | null;
}

// A document_category lookup (from tas_lookup).
export interface DocumentCategoryOption {
  code: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
}

export interface UploadInput {
  file_base64: string;
  file_name: string;
  mime_type: string;
  title?: string;
  category?: string;
  linked_entity_type?: string | null;
  linked_entity_ref?: string | null;
  supersedes_id?: string | null;
  actor_user_id?: string | null;
}
