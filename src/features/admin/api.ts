// Module M0.1-admin-ui — User & Access Administration: data-access layer.
//
// INTERIM: the M0.1-admin RPCs (admin_list_users, admin_get_user,
// admin_upsert_user, admin_set_user_status, admin_assign_role/remove_role,
// admin_assign_scope/remove_scope, admin_list_roles) are NOT yet in the generated
// Database types. Route them through a loosely typed client until Lovable applies
// the migration and regenerates types.ts — then swap `db` back to strict `supabase`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminRole,
  AdminUserDetail,
  AdminUserFilter,
  AdminUserRow,
  UpsertUserInput,
} from "./types";

// INTERIM: swap to strict client after Lovable applies migration (regen types.ts).
const db = supabase as unknown as SupabaseClient;

// Map a raised RPC token (error.message) to a known admin error code, else null.
const KNOWN_ERRORS = [
  "not_authorized",
  "cannot_remove_last_admin",
  "email_exists",
  "email_required",
  "entity_required",
] as const;
export type AdminErrorCode = (typeof KNOWN_ERRORS)[number];

export function adminErrorCode(err: unknown): AdminErrorCode | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  return KNOWN_ERRORS.find((code) => msg.includes(code)) ?? null;
}

// --- Reads ------------------------------------------------------------------

export async function adminListUsers(filter: AdminUserFilter): Promise<AdminUserRow[]> {
  const { data, error } = await db.rpc("admin_list_users", {
    p_search: filter.search ?? undefined,
    p_status: filter.status ?? undefined,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AdminUserRow[];
}

export async function adminGetUser(userId: string): Promise<AdminUserDetail> {
  const { data, error } = await db.rpc("admin_get_user", { p_user_id: userId });
  if (error) throw error;
  return (data ?? { user: null, roles: [], scopes: [], delegations: [] }) as unknown as AdminUserDetail;
}

export async function adminListRoles(): Promise<AdminRole[]> {
  const { data, error } = await db.rpc("admin_list_roles");
  if (error) throw error;
  return (data ?? []) as unknown as AdminRole[];
}

// --- Writes -----------------------------------------------------------------

export async function adminUpsertUser(input: UpsertUserInput): Promise<string> {
  const { data, error } = await db.rpc("admin_upsert_user", {
    p_id: input.id ?? undefined,
    p_email: input.email ?? undefined,
    p_display_name_en: input.display_name_en ?? undefined,
    p_display_name_ar: input.display_name_ar ?? undefined,
    p_status: input.status ?? undefined,
    p_default_locale: input.default_locale ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function adminSetUserStatus(userId: string, status: string): Promise<void> {
  const { error } = await db.rpc("admin_set_user_status", { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export async function adminAssignRole(userId: string, roleId: string): Promise<void> {
  const { error } = await db.rpc("admin_assign_role", { p_user_id: userId, p_role_id: roleId });
  if (error) throw error;
}

export async function adminRemoveRole(userId: string, roleId: string): Promise<void> {
  const { error } = await db.rpc("admin_remove_role", { p_user_id: userId, p_role_id: roleId });
  if (error) throw error;
}

export async function adminAssignScope(
  userId: string,
  entityId: string,
  branchId?: string | null,
  departmentId?: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("admin_assign_scope", {
    p_user_id: userId,
    p_entity_id: entityId,
    p_branch_id: branchId ?? undefined,
    p_department_id: departmentId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function adminRemoveScope(scopeId: string): Promise<void> {
  const { error } = await db.rpc("admin_remove_scope", { p_scope_id: scopeId });
  if (error) throw error;
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[admin] query failed (showing empty):", err);
      return [];
    }
  };
}
