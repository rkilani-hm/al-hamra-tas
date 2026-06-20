// Module M0.1-signin — Auth: TypeScript types.
// Mirrors resolve_current_user / current_user_roles / current_user_scopes RPCs.

export interface TasUserResolution {
  id: string;
  email: string;
  display_name_en: string | null;
  display_name_ar: string | null;
  status: string;
  default_locale: string;
}

export interface CurrentUserRole {
  role_code: string;
  name_en: string;
  name_ar: string;
}

export interface CurrentUserScope {
  entity_id: string;
  branch_id: string | null;
  department_id: string | null;
  is_crossdept_readonly: boolean;
}
