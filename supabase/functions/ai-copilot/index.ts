// =============================================================================
// Edge Function: ai-copilot  (Module M2.1 — AI Recruitment Copilot)
// =============================================================================
// Uses the LOVABLE AI GATEWAY (embedded AI — no external key to manage; Lovable
// auto-injects LOVABLE_API_KEY into edge functions). DORMANT until BOTH the
// tas_ai_adapter_config 'llm' row is enabled AND LOVABLE_API_KEY is present —
// until then returns { dormant: true } and never calls out. When live it calls
// the gateway for:
//   task="generate_jd"       -> bilingual (EN/AR) job description from title + notes
//   task="parse_cv"          -> structured JSON candidate fields from raw CV text
//   task="summarize_meeting" -> bilingual summary + key points + recommendation for
//                               an interview note (reads/persists tas_interview_note)
//
// Gateway (OpenAI-compatible chat completions):
//   POST https://ai.gateway.lovable.dev/v1/chat/completions
//   headers: Authorization: Bearer <LOVABLE_API_KEY>, content-type: application/json
//   body:    { model, messages:[{role:"system"|"user"|"assistant", content}] }
//   resp:    { choices:[{ message:{content}, finish_reason }], usage }
// Model: google/gemini-2.5-flash (fast, low-cost; swap MODEL to change).
// Handles 429 (rate limit) and 402 (out of credits) gracefully.
// LOVABLE_API_KEY is provided automatically in Lovable Cloud — no secret to set.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function lovableKey(): string {
  return Deno.env.get("LOVABLE_API_KEY") ?? "";
}
function aiConfigured(): boolean {
  return !!lovableKey();
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Returns { text, ok, status } — status lets callers surface rate-limit / credit errors.
async function callGateway(messages: ChatMessage[], maxTokens = 3000): Promise<{ text: string; ok: boolean; status: number }> {
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${lovableKey()}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.error(`[ai-copilot] gateway ${resp.status}: ${detail.slice(0, 500)}`);
    return { text: "", ok: false, status: resp.status };
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  return { text, ok: true, status: 200 };
}

function statusMessage(status: number): string {
  if (status === 429) return "AI is rate limited right now. Please try again in a moment.";
  if (status === 402) return "The AI workspace is out of credits. Add credits in Lovable to continue.";
  return "AI request failed. Please try again.";
}

async function generateJd(title: string, notes: string) {
  const system =
    "You are an HR specialist at Al Hamra Real Estate Group in Kuwait. Write a clear, professional job description. " +
    "Each language must contain: a one-paragraph summary, Key Responsibilities (bullet list), and Requirements/Qualifications (bullet list). " +
    "Keep it concise and Kuwait-labor-market appropriate. Do not invent salary or benefits unless given. " +
    "Return ONLY valid JSON — no markdown fences, no prose — with this schema: " +
    '{"summary_en": string, "summary_ar": string}. ' +
    "summary_en is the full English job description; summary_ar is the full Arabic (Modern Standard Arabic) job description.";
  const user =
    `Role title: ${title}\n` +
    (notes ? `Notes / requirements from the hiring team:\n${notes}\n` : "") +
    `\nProduce the job description now as JSON.`;

  const r = await callGateway([{ role: "system", content: system }, { role: "user", content: user }], 3000);
  if (!r.ok) return { dormant: false, output: null, message: statusMessage(r.status) };

  const cleaned = r.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let en = "", ar = "";
  try {
    const p = JSON.parse(cleaned);
    en = String(p?.summary_en ?? "");
    ar = String(p?.summary_ar ?? "");
  } catch {
    // Model didn't return clean JSON — fall back to the raw text in the English field.
    en = r.text;
  }
  const text = [en && `English\n\n${en}`, ar && `العربية\n\n${ar}`].filter(Boolean).join("\n\n———\n\n");
  return { dormant: false, output: { text, summary_en: en, summary_ar: ar }, message: "generated" };
}

async function parseCv(cvText: string) {
  const system =
    "You extract structured candidate data from a raw CV/résumé and return ONLY valid JSON — no markdown fences, no prose. " +
    "Use empty string / empty array when a field is absent; never guess. Schema: " +
    '{"full_name_en":string,"full_name_ar":string,"email":string,"phone":string,"nationality":string,' +
    '"current_title":string,"years_experience":number,"skills":string[],"summary":string}. ' +
    "full_name_ar is the Arabic form of the name if present in the CV, else empty.";
  const r = await callGateway(
    [{ role: "system", content: system }, { role: "user", content: `Extract candidate fields from this CV:\n\n${cvText.slice(0, 20000)}` }],
    1500,
  );
  if (!r.ok) return { dormant: false, output: null, message: statusMessage(r.status) };

  // Strip any accidental ```json fences before parsing.
  const cleaned = r.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown = null;
  try { parsed = JSON.parse(cleaned); } catch { parsed = null; }
  return { dormant: false, output: parsed, message: parsed ? "parsed" : "parse_failed" };
}

// deno-lint-ignore no-explicit-any
async function summarizeMeeting(admin: any, noteId: string) {
  const { data: note } = await admin
    .from("tas_interview_note")
    .select("id, raw_text")
    .eq("id", noteId)
    .maybeSingle();
  if (!note) return { dormant: false, output: null, message: "note_not_found" };
  if (!note.raw_text || !note.raw_text.trim()) return { dormant: false, output: null, message: "empty_note" };

  const system =
    "You summarize a job interview from raw notes or a transcript for an HR system at Al Hamra Real Estate Group in Kuwait. " +
    "Return ONLY valid JSON — no markdown fences, no prose — with this schema: " +
    '{"summary_en":string,"summary_ar":string,"key_points":string[],"recommendation":"proceed"|"hold"|"reject"|""}. ' +
    "summary_en is a concise professional recap (2-4 sentences) in English; summary_ar is the same in Modern Standard Arabic. " +
    "key_points is 3-6 short bullet strings (strengths, concerns, notable answers). " +
    "recommendation is your read of the candidate's fit based ONLY on the notes, or \"\" if unclear. Never invent facts.";
  const user = `Interview notes / transcript:\n\n${note.raw_text.slice(0, 20000)}\n\nSummarize now as JSON.`;

  const r = await callGateway([{ role: "system", content: system }, { role: "user", content: user }], 2000);
  if (!r.ok) return { dormant: false, output: null, message: statusMessage(r.status) };

  const cleaned = r.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let en = "", ar = "", kp: string[] = [], rec = "";
  try {
    const p = JSON.parse(cleaned);
    en = String(p?.summary_en ?? "");
    ar = String(p?.summary_ar ?? "");
    kp = Array.isArray(p?.key_points) ? p.key_points.map((x: unknown) => String(x)) : [];
    rec = ["proceed", "hold", "reject"].includes(p?.recommendation) ? p.recommendation : "";
  } catch {
    en = r.text; // model didn't return clean JSON — keep the raw recap in English
  }

  await admin
    .from("tas_interview_note")
    .update({ summary_en: en, summary_ar: ar, key_points: kp, recommendation: rec || null, ai_generated: true })
    .eq("id", noteId);

  return { dormant: false, output: { summary_en: en, summary_ar: ar, key_points: kp, recommendation: rec }, message: "summarized" };
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
  let noteId = "";
  try {
    const b = await req.json();
    task = (b?.task ?? "generate_jd") as string;
    title = (b?.title ?? "") as string;
    notes = (b?.notes ?? "") as string;
    cvText = (b?.cv_text ?? b?.text ?? "") as string;
    noteId = (b?.note_id ?? "") as string;
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Adapter must be enabled in config AND the embedded key present, or stay dormant.
  const { data: cfg } = await admin
    .from("tas_ai_adapter_config")
    .select("is_enabled")
    .eq("provider", "llm")
    .maybeSingle();

  if (!cfg?.is_enabled || !aiConfigured()) {
    return jsonResponse({
      dormant: true,
      output: null,
      message: "AI copilot is dormant. Enable the AI adapter in System Settings to use it.",
    });
  }

  try {
    if (task === "parse_cv") {
      return jsonResponse(await parseCv(cvText));
    }
    if (task === "summarize_meeting") {
      if (!noteId.trim()) return errorResponse("INVALID_PAYLOAD", 400);
      return jsonResponse(await summarizeMeeting(admin, noteId.trim()));
    }
    // default: generate_jd
    if (!title.trim()) return errorResponse("INVALID_PAYLOAD", 400);
    return jsonResponse(await generateJd(title.trim(), notes.trim()));
  } catch (err) {
    console.error("[ai-copilot] error:", err);
    return jsonResponse({ dormant: false, output: null, message: "ai_error", error: String(err).slice(0, 300) });
  }
});
