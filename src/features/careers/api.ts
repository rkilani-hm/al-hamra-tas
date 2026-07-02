// Module M1.4 — Careers Portal (public): data-access layer.
// Public RPCs granted to anon; uses the anon supabase client when unauthenticated.
// INTERIM: new M1.4 RPCs not in generated types until Lovable regenerates types.ts.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicApplyInput, PublicApplyResult, PublicJob, PublicJobDetail } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

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

export async function submitPublicApplication(input: PublicApplyInput): Promise<PublicApplyResult> {
  const { data, error } = await db.rpc("submit_public_application", {
    p_job_id: input.job_id,
    p_full_name: input.full_name,
    p_email: input.email,
    p_phone: input.phone ?? undefined,
    p_nationality: input.nationality ?? undefined,
    p_cover: input.cover ?? undefined,
  });
  if (error) throw error;
  return data as unknown as PublicApplyResult;
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
