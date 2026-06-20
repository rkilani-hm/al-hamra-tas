// Module M0.1-admin-ui — User & Access Administration: TypeScript types.
// Mirrors the admin_* RPC shapes (supabase/migrations/20260620120000_m0_1_admin_rpc.sql).

export type AdminUserStatus = "unprovisioned" | "active" | "inactive";
export type AppLocale = "en" | "ar";

export interface AdminRoleRef {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
}

export interface AdminRole extends AdminRoleRef {
  is_system: boolean;
}

// admin_list_users() row.
export interface AdminUserRow {
  id: string;
  email: string;
  display_name_en: string | null;
  display_name_ar: string | null;
  status: AdminUserStatus;
  default_locale: AppLocale;
  created_at: string;
  roles: AdminRoleRef[];
  scope_count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  entra_object_id: string | null;
  display_name_en: string | null;
  display_name_ar: string | null;
  status: AdminUserStatus;
  default_locale: AppLocale;
  created_at: string;
  updated_at: string;
}

export interface AdminScope {
  id: string;
  entity_id: string;
  branch_id: string | null;
  department_id: string | null;
  is_crossdept_readonly: boolean;
  entity_name_en: string | null;
  entity_name_ar: string | null;
  branch_name_en: string | null;
  branch_name_ar: string | null;
  department_name_en: string | null;
  department_name_ar: string | null;
}

export interface AdminDelegation {
  id: string;
  delegate_user_id: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

// admin_get_user() jsonb shape.
export interface AdminUserDetail {
  user: AdminUser | null;
  roles: AdminRoleRef[];
  scopes: AdminScope[];
  delegations: AdminDelegation[];
}

export interface UpsertUserInput {
  id?: string | null;
  email?: string | null;
  display_name_en?: string | null;
  display_name_ar?: string | null;
  status?: AdminUserStatus;
  default_locale?: AppLocale;
}

export interface AdminUserFilter {
  search?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}
