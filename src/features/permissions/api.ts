// Module M3.1-step2a — Dynamic Permissions: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include the perm_*/
// roleperm_* / my_capabilities RPCs after Lovable applied the migration and
// regenerated types.ts). Management RPCs are SYSTEM_ADMIN-gated in-RPC;
// my_capabilities resolves the caller's own keys (granted to authenticated).
import { supabase } from "@/integrations/supabase/client";
import type { CatalogPermission, MatrixData, RoleUpsertInput } from "./types";

// Map a raised RPC token (error.message) to a known permissions error code.
const KNOWN_ERRORS = [
  "not_authorized",
  "role_in_use",
  "cannot_delete_system_role",
  "cannot_revoke_core_admin",
  "role_code_exists",
  "role_code_required",
] as const;
export type PermissionErrorCode = (typeof KNOWN_ERRORS)[number];

export function permissionErrorCode(err: unknown): PermissionErrorCode | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  return KNOWN_ERRORS.find((code) => msg.includes(code)) ?? null;
}

// --- Caller capabilities (granted to authenticated; every user resolves own) ---

export async function myCapabilities(): Promise<string[]> {
  const { data, error } = await supabase.rpc("my_capabilities");
  if (error) throw error;
  return data ?? [];
}

// --- Reads (admin-gated) ----------------------------------------------------

export async function permListCatalog(): Promise<CatalogPermission[]> {
  const { data, error } = await supabase.rpc("perm_list_catalog");
  if (error) throw error;
  return (data ?? []) as unknown as CatalogPermission[];
}

export async function rolepermListMatrix(): Promise<MatrixData> {
  const { data, error } = await supabase.rpc("roleperm_list_matrix");
  if (error) throw error;
  return (data ?? { roles: [], permissions: [], grants: [] }) as unknown as MatrixData;
}

// --- Writes (admin-gated) ---------------------------------------------------

export async function roleUpsert(input: RoleUpsertInput): Promise<string> {
  const { data, error } = await supabase.rpc("role_upsert", {
    p_id: input.id ?? undefined,
    p_code: input.code ?? undefined,
    p_name_en: input.name_en ?? undefined,
    p_name_ar: input.name_ar ?? undefined,
    p_description_en: input.description_en ?? undefined,
    p_description_ar: input.description_ar ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function roleDelete(roleId: string): Promise<void> {
  const { error } = await supabase.rpc("role_delete", { p_role_id: roleId });
  if (error) throw error;
}

export async function rolepermGrant(roleId: string, permissionId: string): Promise<void> {
  const { error } = await supabase.rpc("roleperm_grant", { p_role_id: roleId, p_permission_id: permissionId });
  if (error) throw error;
}

export async function rolepermRevoke(roleId: string, permissionId: string): Promise<void> {
  const { error } = await supabase.rpc("roleperm_revoke", { p_role_id: roleId, p_permission_id: permissionId });
  if (error) throw error;
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[permissions] query failed (showing empty):", err);
      return [];
    }
  };
}
