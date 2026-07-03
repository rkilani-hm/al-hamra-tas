// Module M2.4 — Reporting & Analytics: data-access layer.
import { supabase } from "@/integrations/supabase/client";
import type { RecruitmentKpis } from "./types";

const db = supabase;

export async function recruitmentKpis(): Promise<RecruitmentKpis | null> {
  const { data, error } = await db.rpc("recruitment_kpis");
  if (error) throw error;
  return (data ?? null) as unknown as RecruitmentKpis | null;
}
