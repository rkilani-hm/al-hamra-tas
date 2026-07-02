// =============================================================================
// Edge Function: ai-copilot  (Module M2.1 — AI Recruitment Copilot)
// =============================================================================
// Anthropic Messages API adapter. DORMANT until BOTH the tas_ai_adapter_config
// 'llm' row is enabled AND an API key is present — until then returns
// { dormant: true } and never calls out. When live it calls Claude for:
//   task="generate_jd"  -> bilingual (EN/AR) job description from title + notes
//   task="parse_cv"     -> structured JSON candidate fields from raw CV text
//
// Required secrets (Supabase/Lovable env; NEVER hardcode) — provision to go live:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   AI_PROVIDER (e.g. 'anthropic'), ANTHROPIC_API_KEY
// Then enable the 'ai/llm' adapter in /app/admin/settings.
//
// API surface (per the claude-api skill):
//   POST https://api.anthropic.com/v1/messages
//   headers: x-api-key, anthropic-version: 2023-06-01, content-type: application/json
//   body:    { model, max_tokens, system?, messages:[{role,content}], output_config? }
//   resp:    { content:[{type:"text",text}], stop_reason, usage }
// Model: claude-opus-4-8. Non-streaming with max_tokens<=4096 stays well under
// the edge-function/HTTP timeout. Check stop_reason before reading content.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-opus-4-8";

function apiKey(): string {
  return Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("AI_API_KEY") ?? "";
}
function llmConfigured(): boolean {
  const provider = Deno.env.get("AI_PROVIDER") ?? "";
  return !!provider && !!apiKey();
}

// deno-lint-ignore no-explicit-any
type AnthropicMessage = { role: "user" | "assistant"; content: any };

async function callClaude(opts: {
  system?: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  // deno-lint-ignore no-explicit-any
  outputConfig?: any;
}): Promise<{ text: string; stop_reason: string; raw: unknown }> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
  };
  if (opts.system) body.system = opts.system;
  if (opts.outputConfig) body.output_config = opts.outputConfig;

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`anthropic_error_${resp.status}: ${detail.slice(0, 500)}`);
  }

  const data = await resp.json();
  // Refusal / safety: content may be empty — surface a message rather than crash.
  if (data?.stop_reason === "refusal") {
    return { text: "", stop_reason: "refusal", raw: data };
  }
  // deno-lint-ignore no-explicit-any
  const textBlock = (data?.content ?? []).find((b: any) => b?.type === "text");
  return { text: textBlock?.text ?? "", stop_reason: data?.stop_reason ?? "end_turn", raw: data };
}

async function generateJd(title: string, notes: string) {
  const system =
    "You are an HR specialist at Al Hamra Real Estate Group in Kuwait. Write a clear, professional job description. " +
    "Return it in BOTH English and Arabic (Modern Standard Arabic, RTL-appropriate). " +
    "Structure each language with: a one-paragraph summary, Key Responsibilities (bullet list), and Requirements/Qualifications (bullet list). " +
    "Keep it concise and Kuwait-labor-market appropriate. Do not invent salary or benefits unless given.";
  const user =
    `Role title: ${title}\n` +
    (notes ? `Notes / requirements from the hiring team:\n${notes}\n` : "") +
    `\nProduce the job description now. Label the two halves clearly: "English" then "العربية".`;
  const r = await callClaude({ system, messages: [{ role: "user", content: user }], maxTokens: 3000 });
  if (r.stop_reason === "refusal") {
    return { dormant: false, output: null, message: "The request was declined by the safety system. Please rephrase." };
  }
  return { dormant: false, output: r.text, message: "generated" };
}

const CV_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    full_name_en: { type: "string" },
    full_name_ar: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    nationality: { type: "string" },
    current_title: { type: "string" },
    years_experience: { type: "number" },
    skills: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["full_name_en", "email", "skills", "summary"],
};

async function parseCv(cvText: string) {
  const system =
    "You extract structured candidate data from a raw CV/résumé. " +
    "Return ONLY the fields requested. Use empty string / empty array when a field is absent — never guess. " +
    "full_name_ar is the Arabic form of the name if present in the CV, else empty.";
  const r = await callClaude({
    system,
    messages: [{ role: "user", content: `Extract candidate fields from this CV:\n\n${cvText.slice(0, 20000)}` }],
    maxTokens: 1500,
    outputConfig: { format: { type: "json_schema", schema: CV_SCHEMA } },
  });
  if (r.stop_reason === "refusal") {
    return { dormant: false, output: null, message: "The request was declined by the safety system." };
  }
  let parsed: unknown = null;
  try { parsed = JSON.parse(r.text); } catch { parsed = null; }
  return { dormant: false, output: parsed, message: parsed ? "parsed" : "parse_failed" };
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
  let cvText = "";
  try {
    const b = await req.json();
    task = (b?.task ?? "generate_jd") as string;
    title = (b?.title ?? "") as string;
    notes = (b?.notes ?? "") as string;
    cvText = (b?.cv_text ?? b?.text ?? "") as string;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Adapter must be enabled in config AND a key present, or stay dormant.
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

  try {
    if (task === "parse_cv") {
      return jsonResponse(await parseCv(cvText));
    }
    // default: generate_jd
    if (!title.trim()) return errorResponse("INVALID_PAYLOAD", 400);
    return jsonResponse(await generateJd(title.trim(), notes.trim()));
  } catch (err) {
    console.error("[ai-copilot] error:", err);
    // Degrade gracefully — the UI shows a retry message rather than crashing.
    return jsonResponse({ dormant: false, output: null, message: "ai_error", error: String(err).slice(0, 300) });
  }
});
