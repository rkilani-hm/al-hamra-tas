// Module M3.1-step2a — Dynamic Permissions: TypeScript types.
// Mirrors the perm_*/roleperm_* RPC shapes (20260620140000_m3_1_step2a_permissions.sql).

export interface CatalogPermission {
  id: string;
  key: string;
  area: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  is_system: boolean;
}

export interface MatrixRole {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_system: boolean;
  description_en: string | null;
  description_ar: string | null;
  user_count: number;
}

export interface MatrixPermission {
  id: string;
  key: string;
  area: string;
  name_en: string;
  name_ar: string;
}

export interface MatrixGrant {
  role_id: string;
  permission_id: string;
}

export interface MatrixData {
  roles: MatrixRole[];
  permissions: MatrixPermission[];
  grants: MatrixGrant[];
}

export interface RoleUpsertInput {
  id?: string | null;
  code?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
}

// Core admin permission keys locked-on for SYSTEM_ADMIN (cannot be revoked).
export const CORE_ADMIN_KEYS = ["user.admin", "config.manage"] as const;
