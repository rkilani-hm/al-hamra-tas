// Module M1.5 — Application Tracking (ATS): data-access layer.
//
// Strict typed `supabase` client is reused for EXISTING tables via the config /
// requisition feature APIs (lookups, requisitions). The brand-new M1.5 tables +
// RPCs aren't in the generated Database type until Lovable applies this module's
// migration, so they go through a loosely-typed view of the client.
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  ApplicationDetailData,
  ApplicationFilter,
  ApplicationListRow,
  Candidate,
  CandidateInput,
  PipelineStage,
} from "./types";

// INTERIM: swap after apply — remove this cast once tas_candidate /
// tas_pipeline_stage / tas_application / tas_application_stage_history + RPCs
// land in types.ts.
const db = supabase as unknown as SupabaseClient;

// --- Pipeline stages --------------------------------------------------------

// Active stages (board / move pickers).
export async function listPipelineStages(): Promise<PipelineStage[]> {
  const { data, error } = await db.rpc("list_pipeline_stages");
  if (error) throw error;
  return (data ?? []) as PipelineStage[];
}

// ALL stages (StageConfig admin) — direct table read (SELECT granted).
export async function listAllStages(): Promise<PipelineStage[]> {
  const { data, error } = await db
    .from("tas_pipeline_stage")
    .select("id, code, name_en, name_ar, sort_order, stage_type, is_terminal, status")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as PipelineStage[];
}

// Stage config write (service-role until M3.1 — fails-soft for authenticated).
export async function updateStage(
  id: string,
  patch: Partial<Pick<PipelineStage, "sort_order" | "status" | "name_en" | "name_ar">>,
): Promise<void> {
  const { error } = await db.from("tas_pipeline_stage").update(patch).eq("id", id);
  if (error) throw error;
}

// --- Applications -----------------------------------------------------------

export async function listApplications(filter: ApplicationFilter): Promise<ApplicationListRow[]> {
  const { data, error } = await db.rpc("list_applications", {
    p_requisition_id: filter.requisitionId ?? null,
    p_stage_id: filter.stageId ?? null,
    p_status: filter.status ?? null,
    p_candidate_search: filter.candidateSearch ?? null,
    p_mine: filter.mine ?? false,
    p_limit: filter.limit ?? 100,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as ApplicationListRow[];
}

export async function applicationDetail(id: string): Promise<ApplicationDetailData> {
  const { data, error } = await db.rpc("application_detail", { p_id: id });
  if (error) throw error;
  return (data ?? { application: null, candidate: null, current_stage: null, requisition: null, history: [] }) as ApplicationDetailData;
}

// Recruiter actions (authenticated-callable RPCs).
export async function createApplication(
  requisitionId: string,
  candidateId: string,
  source?: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("create_application", {
    p_requisition_id: requisitionId,
    p_candidate_id: candidateId,
    p_source: source ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function moveApplicationStage(
  applicationId: string,
  toStageId: string,
  note?: string | null,
): Promise<void> {
  const { error } = await db.rpc("move_application_stage", {
    p_application_id: applicationId,
    p_to_stage_id: toStageId,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function setApplicationStatus(
  applicationId: string,
  status: string,
  reason?: string | null,
): Promise<void> {
  const { error } = await db.rpc("set_application_status", {
    p_application_id: applicationId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

// --- Candidates -------------------------------------------------------------

export async function listCandidates(search?: string | null): Promise<Candidate[]> {
  let query = db
    .from("tas_candidate")
    .select(
      "id, first_name, last_name, full_name_en, full_name_ar, email, phone, nationality, nationality_class, current_title, source, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`full_name_en.ilike.${s},full_name_ar.ilike.${s},email.ilike.${s}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Candidate[];
}

// A candidate's applications (candidate detail). Direct table read with embeds —
// list_applications has no candidate filter by spec, so we query the table.
export async function applicationsForCandidate(candidateId: string): Promise<ApplicationListRow[]> {
  const { data, error } = await db
    .from("tas_application")
    .select(
      "id, reference, requisition_id, candidate_id, current_stage_id, status, applied_at, created_at, tas_requisition(reference), tas_pipeline_stage(name_en, name_ar, stage_type)",
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string; reference: string | null; requisition_id: string; candidate_id: string;
    current_stage_id: string | null; status: string; applied_at: string; created_at: string;
    tas_requisition: { reference: string | null } | null;
    tas_pipeline_stage: { name_en: string; name_ar: string; stage_type: string } | null;
  };
  // PostgREST returns the to-one embeds as objects at runtime; the select-string
  // type-inference widens them to arrays, so cast through unknown.
  return ((data ?? []) as unknown as Row[]).map((r): ApplicationListRow => ({
    id: r.id,
    reference: r.reference,
    requisition_id: r.requisition_id,
    requisition_reference: r.tas_requisition?.reference ?? null,
    candidate_id: r.candidate_id,
    candidate_name_en: null,
    candidate_name_ar: null,
    current_stage_id: r.current_stage_id,
    stage_name_en: r.tas_pipeline_stage?.name_en ?? null,
    stage_name_ar: r.tas_pipeline_stage?.name_ar ?? null,
    stage_type: (r.tas_pipeline_stage?.stage_type ?? null) as ApplicationListRow["stage_type"],
    status: r.status as ApplicationListRow["status"],
    owner_user_id: null,
    applied_at: r.applied_at,
    created_at: r.created_at,
  }));
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const { data, error } = await db
    .from("tas_candidate")
    .select(
      "id, first_name, last_name, full_name_en, full_name_ar, email, phone, nationality, nationality_class, current_title, source, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Candidate | null;
}

export async function upsertCandidate(input: CandidateInput): Promise<string> {
  const { data, error } = await db.rpc("upsert_candidate", {
    p_id: input.id ?? null,
    p_first_name: input.first_name ?? null,
    p_last_name: input.last_name ?? null,
    p_full_name_en: input.full_name_en ?? null,
    p_full_name_ar: input.full_name_ar ?? null,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_nationality: input.nationality ?? null,
    p_nationality_class: input.nationality_class ?? null,
    p_current_title: input.current_title ?? null,
    p_source: input.source ?? null,
  });
  if (error) throw error;
  return data as string;
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[applications] query failed (showing empty):", err);
      return [];
    }
  };
}
