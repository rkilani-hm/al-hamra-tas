// Module M0.1 — Identity & Access: Supabase data-access layer.
//
// All calls go through the shared browser client (@/integrations/supabase/client),
// i.e. PostgREST under the user's session. Writes that the M0.1 RLS scaffold
// restricts to service_role are expected to run via the auth-callback edge
// function / future admin RPCs; the mutating helpers here are the client-side
// contract and will succeed once M3.1 opens per-role write policies (or when
// called by a service-role context).

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  CreateDelegationInput,
  Delegation,
  SetScopeInput,
  TasPermission,
  TasRole,
  TasUser,
  UserScope,
  UserWithAccess,
} from "./types";

// The generated Database type (src/integrations/supabase/types.ts) currently
// exposes NO tables, so the strongly-typed client rejects the tas_* names at
// compile time. Lovable regenerates that file to include the tas_* tables once
// this module's migration is applied on sync; until then we access PostgREST
// through a loosely-typed view of the client. Swap back to `supabase` (and
// delete this alias) after types.ts is regenerated for full end-to-end typing.
const db = supabase as unknown as SupabaseClient;

// --- Reads ------------------------------------------------------------------

export async function listUsers(): Promise<UserWithAccess[]> {
  const { data, error } = await db
    .from("tas_user")
    .select(
      `*,
       tas_user_role ( tas_role ( id, code, name_en, name_ar, is_system, status ) ),
       tas_user_scope ( id, user_id, entity_id, branch_id, department_id, is_crossdept_readonly )`,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row): UserWithAccess => {
    // deno-lint-ignore no-explicit-any
    const r = row as any;
    return {
      ...(r as TasUser),
      roles: (r.tas_user_role ?? [])
        .map((ur: { tas_role: TasRole }) => ur.tas_role)
        .filter(Boolean),
      scope: (r.tas_user_scope ?? []) as UserScope[],
    };
  });
}

export async function getUser(userId: string): Promise<UserWithAccess | null> {
  const { data, error } = await db
    .from("tas_user")
    .select(
      `*,
       tas_user_role ( tas_role ( id, code, name_en, name_ar, is_system, status ) ),
       tas_user_scope ( id, user_id, entity_id, branch_id, department_id, is_crossdept_readonly )`,
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // deno-lint-ignore no-explicit-any
  const r = data as any;
  return {
    ...(r as TasUser),
    roles: (r.tas_user_role ?? [])
      .map((ur: { tas_role: TasRole }) => ur.tas_role)
      .filter(Boolean),
    scope: (r.tas_user_scope ?? []) as UserScope[],
  };
}

export async function listRoles(): Promise<TasRole[]> {
  const { data, error } = await db
    .from("tas_role")
    .select("id, code, name_en, name_ar, is_system, status")
    .order("code");
  if (error) throw error;
  return (data ?? []) as TasRole[];
}

export async function listPermissions(): Promise<TasPermission[]> {
  const { data, error } = await db
    .from("tas_permission")
    .select("id, module_code, action, name_en, name_ar")
    .order("module_code")
    .order("action");
  if (error) throw error;
  return (data ?? []) as TasPermission[];
}

// Role -> permission grants (used by the matrix to mark checked cells).
export async function listRolePermissions(): Promise<
  { role_id: string; permission_id: string }[]
> {
  const { data, error } = await db
    .from("tas_role_permission")
    .select("role_id, permission_id");
  if (error) throw error;
  return (data ?? []) as { role_id: string; permission_id: string }[];
}

// --- Writes (see file header re: RLS / service-role) ------------------------

// Replace a user's role assignments with the given set.
export async function assignRoles(
  userId: string,
  roleIds: string[],
): Promise<void> {
  const { error: delErr } = await db
    .from("tas_user_role")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw delErr;

  if (roleIds.length === 0) return;

  const rows = roleIds.map((role_id) => ({ user_id: userId, role_id }));
  const { error: insErr } = await db.from("tas_user_role").insert(rows);
  if (insErr) throw insErr;
}

export async function setScope(input: SetScopeInput): Promise<UserScope> {
  const { data, error } = await db
    .from("tas_user_scope")
    .insert({
      user_id: input.user_id,
      entity_id: input.entity_id,
      branch_id: input.branch_id ?? null,
      department_id: input.department_id ?? null,
      is_crossdept_readonly: input.is_crossdept_readonly ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserScope;
}

export async function createDelegation(
  input: CreateDelegationInput,
): Promise<Delegation> {
  const { data, error } = await db
    .from("tas_delegation")
    .insert({
      delegator_user_id: input.delegator_user_id,
      delegate_user_id: input.delegate_user_id,
      type: input.type,
      scope_json: input.scope_json ?? [],
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Delegation;
}

export async function revokeDelegation(delegationId: string): Promise<void> {
  const { error } = await db
    .from("tas_delegation")
    .update({ status: "revoked" })
    .eq("id", delegationId);
  if (error) throw error;
}
