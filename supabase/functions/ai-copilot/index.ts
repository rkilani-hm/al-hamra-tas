// =============================================================================
// Edge Function: ai-copilot  (Module M2.1 — AI Recruitment Copilot)
// =============================================================================
// DORMANT LLM adapter. Best-effort invoked by the frontend for JD generation /
// CV parsing / ranking. Until an LLM API key is provisioned AND the adapter is
// enabled (tas_ai_adapter_config), this returns { dormant: true } — never a fake
// completion. Degradation is a feature — never crash.
//
// Required secrets (Supabase/Lovable env; NEVER hardcode) — provision to go live:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   AI_PROVIDER (e.g. 'anthropic'), ANTHROPIC_API_KEY (or the chosen provider key)
// Then enable the 'ai/llm' adapter in /app/admin/settings.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

function llmConfigured(): boolean {
  const provider = Deno.env.get("AI_PROVIDER") ?? "";
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("AI_API_KEY") ?? "";
  return !!provider && !!key;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let task = "generate_jd";
  let title = "";
  let notes = "";
  try {
    const body = await req.json();
    task = (body?.task ?? "generate_jd") as string;
    title = (body?.title ?? "") as string;
    notes = (body?.notes ?? "") as string;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Adapter must be enabled in config AND a key present.
  const { data: cfg } = await admin
    .from("tas_ai_adapter_config")
    .select("is_enabled")
    .eq("provider", "llm")
    .maybeSingle();

  if (!cfg?.is_enabled || !llmConfigured()) {
    return jsonResponse({
      dormant: true,
      output: null,
      message: "AI copilot is dormant. Provision an LLM API key and enable the adapter in System Settings.",
    });
  }

  // Adapter live: real provider call goes here once wired. Kept minimal/dormant.
  return jsonResponse({ dormant: false, output: null, task, title, notes, message: "accepted" });
});
