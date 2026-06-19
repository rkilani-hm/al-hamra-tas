// =============================================================================
// Edge Function: offer-esign  (Module M1.9 — Offer Management)
// =============================================================================
// DORMANT e-signature adapter for issued offers. Best-effort invoked (fire-and-
// forget) by the frontend after issue_offer. In-app recruiter-recorded
// accept/decline works regardless of this function — it only creates a signing
// request WHEN an e-sign provider is configured.
//
// Behavior (degradation is a feature — never crash):
//   * No e-sign provider configured (the default state today) -> set
//     tas_offer.esign_status='skipped' and return. NOT 'failed'.
//   * Provider configured + secrets present -> create a signing request, set
//     esign_status='pending', store the provider ref.
//   * On any provider error -> esign_status='failed' + a note; return 200.
//
// Required secrets (Supabase/Lovable env; NEVER hardcode) — provider is TBD, so
// no concrete secret NAMES are committed yet. When Al Hamra chooses a provider
// (DocuSign / Adobe Sign / etc.), document its secrets here, e.g.:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ESIGN_PROVIDER (e.g. 'docusign'), ESIGN_API_BASE, ESIGN_API_KEY, ESIGN_ACCOUNT_ID
//
// NOTE: the createSigningRequest helper throws UnconfiguredError until a provider
// is wired, which the handler maps to 'skipped'. Reuses _shared/cors.ts + errors.ts.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

class UnconfiguredError extends Error {}

interface OfferRow {
  id: string;
  reference: string | null;
  candidate_id: string;
}

// Is an e-sign provider configured? No provider is wired yet (dormant), so this
// is always false until ESIGN_PROVIDER + its secrets are provisioned.
function esignConfigured(): boolean {
  const provider = Deno.env.get("ESIGN_PROVIDER") ?? "";
  const apiKey = Deno.env.get("ESIGN_API_KEY") ?? "";
  return !!provider && !!apiKey;
}

// DORMANT: create a signing request via the chosen provider. Throws until wired.
async function createSigningRequest(_offer: OfferRow): Promise<string> {
  await Promise.resolve();
  throw new UnconfiguredError("E-sign provider is dormant until a provider is chosen and configured.");
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let offerId: string | null = null;
  try {
    const body = await req.json();
    offerId = (body?.offer_id ?? body?.id ?? null) as string | null;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }
  if (!offerId) return errorResponse("INVALID_PAYLOAD", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: offer } = await admin
      .from("tas_offer")
      .select("id, reference, candidate_id")
      .eq("id", offerId)
      .maybeSingle();
    if (!offer) return errorResponse("INVALID_PAYLOAD", 404);

    // Provider not configured -> skipped (the default state today). Never 'failed'.
    if (!esignConfigured()) {
      await admin.from("tas_offer").update({ esign_status: "skipped" }).eq("id", offerId);
      return jsonResponse({ offer_id: offerId, esign_status: "skipped" });
    }

    try {
      await createSigningRequest(offer as OfferRow);
      await admin.from("tas_offer").update({ esign_status: "pending" }).eq("id", offerId);
      return jsonResponse({ offer_id: offerId, esign_status: "pending" });
    } catch (err) {
      if (err instanceof UnconfiguredError) {
        await admin.from("tas_offer").update({ esign_status: "skipped" }).eq("id", offerId);
        return jsonResponse({ offer_id: offerId, esign_status: "skipped", note: err.message });
      }
      await admin.from("tas_offer").update({ esign_status: "failed" }).eq("id", offerId);
      return jsonResponse({ offer_id: offerId, esign_status: "failed", note: String(err) });
    }
  } catch (err) {
    console.error("[offer-esign] error:", err);
    return errorResponse("INTERNAL_ERROR", 500);
  }
});
