// Module M0.1-signin — Auth: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include the
// resolve_current_user / current_user_roles / current_user_scopes RPCs after
// Lovable applied the migration and regenerated types.ts).
import { supabase } from "@/integrations/supabase/client";
import type { CurrentUserRole, CurrentUserScope, TasUserResolution } from "./types";

// The Entra SAML domain routed to this tenant (non-secret constant).
export const SSO_DOMAIN = "alhamra.com.kw";

// Resolve the authenticated session to a tas_user (server-side). Returns null for
// unprovisioned users (no active tas_user) -> the app routes them to /no-access.
export async function resolveCurrentUser(): Promise<TasUserResolution | null> {
  const { data, error } = await supabase.rpc("resolve_current_user");
  if (error) throw error;
  const rows = (data ?? []) as unknown as TasUserResolution[];
  return rows.length > 0 ? rows[0] : null;
}

export async function currentUserRoles(): Promise<CurrentUserRole[]> {
  const { data, error } = await supabase.rpc("current_user_roles");
  if (error) throw error;
  return (data ?? []) as unknown as CurrentUserRole[];
}

export async function currentUserScopes(): Promise<CurrentUserScope[]> {
  const { data, error } = await supabase.rpc("current_user_scopes");
  if (error) throw error;
  return (data ?? []) as unknown as CurrentUserScope[];
}

// --- SSO actions ------------------------------------------------------------

// Begin Entra SAML SSO. Supabase returns a redirect URL we navigate to.
export async function signInWithSso(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithSSO({ domain: SSO_DOMAIN });
  if (error) throw error;
  if (data?.url && typeof window !== "undefined") {
    window.location.href = data.url;
  }
}

export async function signOutSso(): Promise<void> {
  await supabase.auth.signOut();
}
