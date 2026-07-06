// =============================================================================
// Edge Function: careers-postapply  (Module M2.7 — Website intake, Phase 1)
// =============================================================================
// Best-effort post-application steps for a public careers application (invoked
// AFTER submit_public_application succeeds). Does NOT create the application.
//   1. Candidate confirmation email (Outlook/Graph Mail.Send) — only when the
//      outlook_email adapter is live + secrets present; else silently skipped.
//   2. AI enrichment — parse the applicant's cover/notes text via the ai-copilot
//      parse_cv task (dormant-aware) and fill candidate skills/title/experience.
// Every step is wrapped so a failure never affects the applicant. Anon-invokable.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

const GRAPH = "https://graph.microsoft.com/v1.0";

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() !== "" ? v : undefined;
}

async function graphToken(): Promise<string | null> {
  const tenant = env("ENTRA_TENANT_ID"), clientId = env("ENTRA_CLIENT_ID"), clientSecret = env("ENTRA_CLIENT_SECRET");
  const scopes = env("GRAPH_SCOPES") ?? "https://graph.microsoft.com/.default";
  if (!tenant || !clientId || !clientSecret) return null;
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: scopes, grant_type: "client_credentials" }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j.access_token ?? null;
}

// deno-lint-ignore no-explicit-any
async function sendConfirmation(admin: any, toEmail: string, name: string, jobTitle: string, locale: string) {
  const { data: cfg } = await admin
    .from("tas_comm_adapter_config")
    .select("is_enabled, config_status")
    .eq("channel", "outlook_email")
    .maybeSingle();
  if (!cfg?.is_enabled || cfg.config_status !== "configured") return;
  const sender = env("GRAPH_SENDER_UPN");
  if (!sender) return;
  const token = await graphToken();
  if (!token) return;

  const ar = locale === "ar";
  const subject = ar ? `تأكيد استلام طلبك — ${jobTitle}` : `We received your application — ${jobTitle}`;
  const content = ar
    ? `عزيزي ${name}،\n\nشكرًا لتقديمك على وظيفة "${jobTitle}" في مجموعة الحمراء العقارية. لقد استلمنا طلبك، وسيقوم فريق التوظيف بمراجعته والتواصل معك في حال تطابق مؤهلاتك مع المتطلبات.\n\nمع أطيب التحيات،\nفريق استقطاب المواهب — مجموعة الحمراء العقارية`
    : `Dear ${name},\n\nThank you for applying for "${jobTitle}" at Al Hamra Real Estate Group. We have received your application. Our Talent Acquisition team will review it and contact you if your profile matches the requirements.\n\nBest regards,\nTalent Acquisition — Al Hamra Real Estate Group`;

  await fetch(`${GRAPH}/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: { subject, body: { contentType: "Text", content }, toRecipients: [{ emailAddress: { address: toEmail } }] },
      saveToSentItems: false,
    }),
  }).catch(() => {});
}

// deno-lint-ignore no-explicit-any
async function enrich(admin: any, candidateId: string, text: string) {
  if (!text || text.trim().length < 30) return; // not enough to parse
  const { data: ai } = await admin.functions.invoke("ai-copilot", { body: { task: "parse_cv", cv_text: text } });
  const parsed = (ai as { dormant?: boolean; output?: Record<string, unknown> } | null);
  if (!parsed || parsed.dormant || !parsed.output) return;
  const p = parsed.output;
  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {};
  if (p.full_name_ar) patch.full_name_ar = p.full_name_ar;
  if (p.current_title) patch.current_title = p.current_title;
  if (Array.isArray(p.skills) && p.skills.length) patch.skills = p.skills;
  if (typeof p.years_experience === "number") patch.years_experience = p.years_experience;
  if (Object.keys(patch).length) {
    await admin.from("tas_candidate").update(patch).eq("id", candidateId);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse("SERVER_MISCONFIGURED", 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_PAYLOAD", 400);
  }

  const candidateId = String(body?.candidate_id ?? "");
  const email = String(body?.email ?? "").trim();
  const name = String(body?.full_name ?? "").trim();
  const jobId = String(body?.job_id ?? "");
  const cover = String(body?.cover ?? "");
  const locale = body?.locale === "ar" ? "ar" : "en";

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve the job title for the email.
  let jobTitle = locale === "ar" ? "الوظيفة" : "the role";
  if (jobId) {
    try {
      const { data: j } = await admin.from("tas_requisition").select("title_en, title_ar, reference").eq("id", jobId).maybeSingle();
      if (j) jobTitle = (locale === "ar" ? j.title_ar : j.title_en) || j.title_en || j.reference || jobTitle;
    } catch { /* keep default */ }
  }

  const result = { email_sent: false, enriched: false };
  if (email && name) {
    try { await sendConfirmation(admin, email, name, jobTitle, locale); result.email_sent = true; } catch { /* best-effort */ }
  }
  if (candidateId && cover) {
    try { await enrich(admin, candidateId, cover); result.enriched = true; } catch { /* best-effort */ }
  }
  return jsonResponse({ ok: true, ...result });
});
