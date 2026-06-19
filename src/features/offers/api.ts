// Module M1.9 — Offer Management: data-access layer.
//
// Uses the strict typed `supabase` client (Database types include the M1.9
// tas_offer / tas_offer_event tables + offer RPCs after Lovable applied the
// migration and regenerated types.ts). Sensitive write RPCs are service-role-
// guarded (revoked from public) and fail-soft for authenticated callers until M3.1.
import { supabase } from "@/integrations/supabase/client";
import type {
  OfferDetailData,
  OfferDraftInput,
  OfferFilter,
  OfferListRow,
  OfferRecord,
} from "./types";

// --- Reads ------------------------------------------------------------------

export async function listOffers(filter: OfferFilter): Promise<OfferListRow[]> {
  const { data, error } = await supabase.rpc("list_offers", {
    p_application_id: filter.applicationId ?? undefined,
    p_candidate_id: filter.candidateId ?? undefined,
    p_status: filter.status ?? undefined,
    p_mine: filter.mine ?? false,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as OfferListRow[];
}

export async function offerDetail(id: string): Promise<OfferDetailData> {
  const { data, error } = await supabase.rpc("offer_detail", { p_id: id });
  if (error) throw error;
  return (data ?? {
    offer: null, application: null, candidate: null, instance: null, letter_snapshot: null, events: [],
  }) as unknown as OfferDetailData;
}

// Derive-on-read: call before rendering the detail to apply terminal transitions.
export async function syncOfferStatus(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("sync_offer_status", { p_offer_id: id });
  if (error) throw error;
  return data ?? null;
}

// --- Writes -----------------------------------------------------------------

// Create an own-draft offer (authenticated own-draft INSERT via RLS).
export async function createDraftOffer(
  input: OfferDraftInput,
  createdBy: string | null,
): Promise<OfferRecord> {
  const { data, error } = await supabase
    .from("tas_offer")
    .insert({ ...input, currency: input.currency ?? "KWD", status: "draft", created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as OfferRecord;
}

// Update a draft's fields. Non-status writes are service-role until M3.1 —
// fails-soft for authenticated callers for now (mirrors M1.2).
export async function updateDraftOffer(id: string, patch: Partial<OfferDraftInput>): Promise<void> {
  const { error } = await supabase.from("tas_offer").update(patch).eq("id", id);
  if (error) throw error;
}

// Submit (service-role-guarded RPC; fails-soft for authenticated until M3.1).
export async function submitOffer(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_offer", { p_offer_id: id });
  if (error) throw error;
}

// Issue (service-role-guarded). Best-effort kicks the dormant e-sign adapter.
export async function issueOffer(id: string): Promise<void> {
  const { error } = await supabase.rpc("issue_offer", { p_offer_id: id });
  if (error) throw error;
  void invokeEsignAdapter(id);
}

// Recruiter-recorded candidate response (service-role-guarded).
export async function respondToOffer(
  id: string,
  decision: "accept" | "decline",
  reason?: string | null,
  signature?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("respond_to_offer", {
    p_offer_id: id,
    p_decision: decision,
    p_reason: reason ?? undefined,
    p_signature: signature ?? undefined,
  });
  if (error) throw error;
}

// Lifecycle transition: cancel | expire (service-role-guarded).
export async function transitionOffer(id: string, action: "cancel" | "expire"): Promise<void> {
  const { error } = await supabase.rpc("transition_offer", { p_offer_id: id, p_action: action });
  if (error) throw error;
}

// Fire-and-forget invoke of the offer-esign edge function. Swallows all errors —
// in-app acceptance works regardless; signing is best-effort.
async function invokeEsignAdapter(offerId: string): Promise<void> {
  try {
    await supabase.functions.invoke("offer-esign", { body: { offer_id: offerId } });
  } catch (err) {
    console.warn("[offers] e-sign adapter invoke failed (non-blocking):", err);
  }
}

// --- Reference data (existing tables — strict client) -----------------------

export interface OfferLookup {
  code: string;
  name_en: string;
  name_ar: string;
}

export async function listLookup(lookupType: string): Promise<OfferLookup[]> {
  const { data, error } = await supabase
    .from("tas_lookup")
    .select("code, name_en, name_ar")
    .eq("lookup_type", lookupType)
    .eq("status", "active")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as OfferLookup[];
}

export interface JobGrade {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
}

export async function listJobGrades(): Promise<JobGrade[]> {
  const { data, error } = await supabase
    .from("tas_job_grade")
    .select("id, code, name_en, name_ar")
    .order("rank");
  if (error) throw error;
  return (data ?? []) as JobGrade[];
}

// --- Shared helper: degrade a read to empty on error ------------------------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[offers] query failed (showing empty):", err);
      return [];
    }
  };
}
