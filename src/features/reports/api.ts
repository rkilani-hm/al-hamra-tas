// Module M2.4 — Reporting & Analytics: data-access layer.
// INTERIM: recruitment_kpis RPC not in generated types until Lovable regenerates.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecruitmentKpis } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function recruitmentKpis(): Promise<RecruitmentKpis | null> {
  const { data, error } = await db.rpc("recruitment_kpis");
  if (error) throw error;
  return (data ?? null) as unknown as RecruitmentKpis | null;
}
