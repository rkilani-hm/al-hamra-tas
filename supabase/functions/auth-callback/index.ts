// =============================================================================
// Edge Function: auth-callback  (Module M0.1 — Identity & Access)
// =============================================================================
// Purpose
//   Resolve a TAS principal AFTER Microsoft Entra ID (OIDC) has authenticated
//   the user on the client. Entra handles AUTHENTICATION ONLY; this function
//   loads the user's TAS-INTERNAL authorization (roles, effective permissions,
//   org scope, active delegations) and records an audit event.
//
// Contract
//   POST { entra_object_id?: string, email?: string,
//          display_name?: string, locale?: 'en' | 'ar',
//          ip?: string, user_agent?: string }
//   (The client passes the VALIDATED id_token claims / user info. Token
//    signature validation happens in the client auth flow against Entra.)
//
//   200 -> { user, roles, permissions, scope, delegations, locale }
//   403 -> { error: <bilingual envelope> }  when the user is inactive
//   On first contact (no matching tas_user) -> a row is INSERTed with status
//   'unprovisioned', a 'provision' audit event is written, and that user is
//   returned (the UI shows an "awaiting access" state; no roles/permissions).
//
// Required secrets (set in Supabase / Lovable — NEVER hardcode here):
//   SUPABASE_URL                 - project URL (auto-provided in Supabase)
//   SUPABASE_SERVICE_ROLE_KEY    - service-role key (bypasses RLS)
//   ENTRA_TENANT_ID              - Entra (Azure AD) tenant id
//   ENTRA_CLIENT_ID              - Entra app registration client id
//   ENTRA_CLIENT_SECRET          - Entra app client secret
//   ENTRA_REDIRECT_URI           - OIDC redirect URI
//   (ENTRA_* are consumed by the OIDC flow / future token validation; listed
//    here so deployment configures them alongside this function.)
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

interface AuthCallbackPayload {
  entra_object_id?: string;
  email?: string;
  display_name?: string;
  locale?: "en" | "ar";
  ip?: string;
  user_agent?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse("SERVER_MISCONFIGURED", 500);
  }

  let payload: AuthCallbackPayload;
  try {
    payload = (await req.json()) as AuthCallbackPayload;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }

  const entraObjectId = payload.entra_object_id?.trim() || null;
  const email = payload.email?.trim().toLowerCase() || null;
  if (!entraObjectId && !email) {
    return errorResponse("IDENTITY_REQUIRED", 400);
  }

  // Service-role client (bypasses RLS — this function is the trusted writer).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ---- 1. Resolve tas_user by entra_object_id, then fall back to email. ----
    let user = await resolveUser(admin, entraObjectId, email);

    // ---- 2. First contact -> provision an 'unprovisioned' user. ----
    if (!user) {
      const { data: inserted, error: insertErr } = await admin
        .from("tas_user")
        .insert({
          entra_object_id: entraObjectId,
          email,
          display_name_en: payload.display_name ?? null,
          status: "unprovisioned",
          default_locale: payload.locale ?? "en",
        })
        .select("*")
        .single();

      if (insertErr) {
        // Unique race: another request provisioned first — re-resolve.
        user = await resolveUser(admin, entraObjectId, email);
        if (!user) throw insertErr;
      } else {
        user = inserted;
        await writeAudit(admin, user.id, "provision", {
          via: entraObjectId ? "entra_object_id" : "email",
        });
      }
    } else if (entraObjectId && !user.entra_object_id) {
      // Matched by email on a previously-stubbed row: backfill the Entra oid.
      const { data: updated } = await admin
        .from("tas_user")
        .update({ entra_object_id: entraObjectId })
        .eq("id", user.id)
        .select("*")
        .single();
      if (updated) user = updated;
    }

    // ---- 3. Inactive users are denied. ----
    if (user.status === "inactive") {
      await writeAudit(admin, user.id, "denied", { reason: "inactive" });
      return errorResponse("USER_INACTIVE", 403);
    }

    // ---- 4. Unprovisioned users: valid identity, but no access yet. ----
    if (user.status === "unprovisioned") {
      return jsonResponse({
        user,
        roles: [],
        permissions: [],
        scope: [],
        delegations: [],
        locale: user.default_locale ?? "en",
      });
    }

    // ---- 5. Active users: load roles, effective permissions, scope, delegations. ----
    const [roles, permissions, scope, delegations] = await Promise.all([
      loadRoles(admin, user.id),
      loadEffectivePermissions(admin, user.id),
      loadScope(admin, user.id),
      loadActiveDelegations(admin, user.id),
    ]);

    await admin
      .from("tas_session")
      .insert({
        user_id: user.id,
        ip: payload.ip ?? null,
        user_agent: payload.user_agent ?? null,
      });

    await writeAudit(admin, user.id, "signin", {
      roles: roles.map((r) => r.code),
    });

    return jsonResponse({
      user,
      roles,
      permissions,
      scope,
      delegations,
      locale: user.default_locale ?? "en",
    });
  } catch (err) {
    console.error("[auth-callback] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type Admin = any;

async function resolveUser(
  admin: Admin,
  entraObjectId: string | null,
  email: string | null,
) {
  if (entraObjectId) {
    const { data } = await admin
      .from("tas_user")
      .select("*")
      .eq("entra_object_id", entraObjectId)
      .maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await admin
      .from("tas_user")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function loadRoles(admin: Admin, userId: string) {
  const { data } = await admin
    .from("tas_user_role")
    .select("tas_role(id, code, name_en, name_ar, status)")
    .eq("user_id", userId);
  // deno-lint-ignore no-explicit-any
  return (data ?? []).map((r: any) => r.tas_role).filter(Boolean);
}

// Effective permissions = union of permissions across all of the user's roles.
async function loadEffectivePermissions(admin: Admin, userId: string) {
  const { data: userRoles } = await admin
    .from("tas_user_role")
    .select("role_id")
    .eq("user_id", userId);

  // deno-lint-ignore no-explicit-any
  const roleIds = (userRoles ?? []).map((r: any) => r.role_id);
  if (roleIds.length === 0) return [];

  const { data } = await admin
    .from("tas_role_permission")
    .select("tas_permission(id, module_code, action, name_en, name_ar)")
    .in("role_id", roleIds);

  // De-duplicate by (module_code|action).
  const seen = new Set<string>();
  const permissions: unknown[] = [];
  // deno-lint-ignore no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const p = row.tas_permission;
    if (!p) continue;
    const key = `${p.module_code}|${p.action}`;
    if (seen.has(key)) continue;
    seen.add(key);
    permissions.push(p);
  }
  return permissions;
}

async function loadScope(admin: Admin, userId: string) {
  const { data } = await admin
    .from("tas_user_scope")
    .select("*")
    .eq("user_id", userId);
  return data ?? [];
}

// Active delegations TO this user, honored only while active and within dates.
async function loadActiveDelegations(admin: Admin, userId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data } = await admin
    .from("tas_delegation")
    .select("*")
    .eq("delegate_user_id", userId)
    .eq("status", "active")
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`);
  return data ?? [];
}

async function writeAudit(
  admin: Admin,
  userId: string | null,
  eventType: string,
  detail: Record<string, unknown>,
) {
  await admin.from("tas_access_audit").insert({
    user_id: userId,
    event_type: eventType,
    detail_json: detail,
  });
}
