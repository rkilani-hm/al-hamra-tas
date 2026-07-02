// Module M1.1 — Manpower Planning & Headcount: data-access layer.
// INTERIM: new M1.1 table/RPCs not in generated types until Lovable regenerates
// types.ts after apply. Loose-cast now; swap `db` to strict `supabase` after apply.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManpowerPlanInput, ManpowerPlanRow } from "./types";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export async function listManpowerPlans(fiscalYear?: number | null): Promise<ManpowerPlanRow[]> {
  const { data, error } = await db.rpc("list_manpower_plans", {
    p_fiscal_year: fiscalYear ?? undefined,
    p_limit: 200,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ManpowerPlanRow[];
}

export async function upsertManpowerPlan(input: ManpowerPlanInput): Promise<string> {
  const { data, error } = await db.rpc("upsert_manpower_plan", {
    p_id: input.id ?? undefined,
    p_fiscal_year: input.fiscal_year,
    p_entity_id: input.entity_id ?? undefined,
    p_department_id: input.department_id ?? undefined,
    p_job_position_id: input.job_position_id ?? undefined,
    p_budgeted: input.budgeted_headcount,
    p_kuwait_pct: input.kuwaitization_target_pct ?? undefined,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function setManpowerStatus(id: string, status: string): Promise<void> {
  const { error } = await db.rpc("set_manpower_status", { p_id: id, p_status: status });
  if (error) throw error;
}

export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[manpower] query failed (showing empty):", err);
      return [];
    }
  };
}
