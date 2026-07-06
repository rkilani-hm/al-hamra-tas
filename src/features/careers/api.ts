// Module M1.4 / M2.7 — Careers Portal (public): data-access layer.
// Public RPCs granted to anon; uses the anon supabase client when unauthenticated.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicApplyInput, PublicApplyResult, PublicJob, PublicJobDetail } from "./types";

const db = supabase;
// INTERIM: submit_public_application gained p_source/p_resume_ref (M2.7) — the
// generated Args type lags until Lovable regenerates types.ts; loose-cast this call.
const rpc = supabase as unknown as SupabaseClient;

export async function listPublicJobs(): Promise<PublicJob[]> {
  const { data, error } = await db.rpc("list_public_jobs");
  if (error) throw error;
  return (data ?? []) as unknown as PublicJob[];
}

export async function publicJobDetail(id: string): Promise<PublicJobDetail> {
  const { data, error } = await db.rpc("public_job_detail", { p_id: id });
  if (error) throw error;
  return (data ?? { job: null, department: null, jd: null }) as unknown as PublicJobDetail;
}

// Upload a résumé to the careers-upload edge function. Returns a storage ref, or
// null on any failure (the application still submits without a CV). M2.7.
export async function uploadCareersCv(file: File): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const { data, error } = await supabase.functions.invoke("careers-upload", {
      body: { content_type: file.type, data_base64: btoa(bin) },
    });
    if (error) return null;
    const r = data as { ok?: boolean; resume_ref?: string };
    return r?.ok ? (r.resume_ref ?? null) : null;
  } catch (err) {
    console.warn("[careers] CV upload failed (submitting without CV):", err);
    return null;
  }
}

export async function submitPublicApplication(input: PublicApplyInput, locale = "en"): Promise<PublicApplyResult> {
  const { data, error } = await rpc.rpc("submit_public_application", {
    p_job_id: input.job_id,
    p_full_name: input.full_name,
    p_email: input.email,
    p_phone: input.phone ?? undefined,
    p_nationality: input.nationality ?? undefined,
    p_cover: input.cover ?? undefined,
    p_source: "website",
    p_resume_ref: input.resume_ref ?? undefined,
  });
  if (error) throw error;
  const res = data as unknown as PublicApplyResult;

  // Best-effort post-apply steps — never block or fail the applicant. These activate
  // once the careers-postapply edge function is deployed (candidate confirmation
  // email + AI enrichment); notification-dispatch delivers the recruiter alert.
  if (!res?.duplicate) {
    void supabase.functions
      .invoke("careers-postapply", {
        body: {
          candidate_id: res?.candidate_id ?? null,
          email: input.email,
          full_name: input.full_name,
          job_id: input.job_id,
          cover: input.cover,
          locale,
        },
      })
      .catch(() => {});
    void supabase.functions.invoke("notification-dispatch", { body: {} }).catch(() => {});
  }
  return res;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[careers] query failed (showing empty):", err);
      return [];
    }
  };
}
