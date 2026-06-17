// Module M0.1 — Identity & Access: TypeScript types mirroring the tas_* tables.
//
// These are hand-written to match supabase/migrations/20260617090000_m0_1_identity.sql.
// (The generated src/integrations/supabase/types.ts is currently empty; regenerate
//  it from the DB later if you want fully typed PostgREST calls.)

export type UserStatus = "unprovisioned" | "active" | "inactive";
export type AppLocale = "en" | "ar";
export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "approve"
  | "delete"
  | "export";
export type DelegationType = "role_wide" | "task_specific";
export type DelegationStatus = "active" | "expired" | "revoked";

// --- Org stubs (M0.2 expands) ----------------------------------------------
export interface TasEntity {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
}

export interface TasBranch {
  id: string;
  entity_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
}

export interface TasDepartment {
  id: string;
  branch_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
}

// --- Identity & access core -------------------------------------------------
export interface TasUser {
  id: string;
  entra_object_id: string | null;
  email: string;
  display_name_en: string | null;
  display_name_ar: string | null;
  status: UserStatus;
  default_locale: AppLocale;
  created_at: string;
  updated_at: string;
}

export interface TasRole {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_system: boolean;
  status: string;
}

export interface TasPermission {
  id: string;
  module_code: string;
  action: PermissionAction;
  name_en: string | null;
  name_ar: string | null;
}

export interface UserScope {
  id: string;
  user_id: string;
  entity_id: string;
  branch_id: string | null;
  department_id: string | null;
  is_crossdept_readonly: boolean;
}

export interface Delegation {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  type: DelegationType;
  scope_json: unknown;
  start_date: string | null;
  end_date: string | null;
  status: DelegationStatus;
}

// --- Composite / view models used by the UI --------------------------------

// A user row enriched with the data the UserTable renders.
export interface UserWithAccess extends TasUser {
  roles: TasRole[];
  scope: UserScope[];
}

// Input payloads for write operations.
export interface SetScopeInput {
  user_id: string;
  entity_id: string;
  branch_id?: string | null;
  department_id?: string | null;
  is_crossdept_readonly?: boolean;
}

export interface CreateDelegationInput {
  delegator_user_id: string;
  delegate_user_id: string;
  type: DelegationType;
  scope_json?: unknown;
  start_date?: string | null;
  end_date?: string | null;
}
