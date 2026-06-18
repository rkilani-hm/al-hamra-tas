// Module M0.4 — Notifications & Communications: data-access layer.
//
// INTERIM (same pattern as M0.1–M0.3): the M0.4 tables and RPCs are not in the
// generated Database type until Lovable applies this module's migrations on sync.
// Until then we access PostgREST/rpc through a loosely-typed view of the client.
// Follow-up: swap `db` back to the strict typed `supabase` client (and delete
// this alias) after the M0.4 migrations are applied.
//
// RLS posture: notifications are self-scoped (recipient reads; own-row mark-read);
// prefs are own-row read/write; templates + adapter config are authenticated read,
// service-role write. User-facing RPCs (my_notifications, unread_count,
// mark_notification_read, preview_template) are granted to authenticated; the
// producer/admin RPCs (notify, render_template, retry_notification) are
// service-role only until M3.1, so those calls fail-soft in the UI.

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type {
  CommAdapterConfig,
  InAppNotification,
  Notification,
  NotificationPref,
  NotificationTemplate,
  RenderedTemplate,
} from "./types";

const db = supabase as unknown as SupabaseClient;

// --- In-app notifications (RPC; user-facing) --------------------------------

export async function myNotifications(
  userId: string,
  unreadOnly = false,
): Promise<InAppNotification[]> {
  const { data, error } = await db.rpc("my_notifications", {
    p_user_id: userId,
    p_unread_only: unreadOnly,
  });
  if (error) throw error;
  return (data ?? []) as InAppNotification[];
}

export async function unreadCount(userId: string): Promise<number> {
  const { data, error } = await db.rpc("unread_count", { p_user_id: userId });
  if (error) throw error;
  return (data ?? 0) as number;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await db.rpc("mark_notification_read", { p_id: id });
  if (error) throw error;
}

export async function markAllRead(userId: string): Promise<void> {
  // PostgREST update of own rows (allowed by the self-update RLS policy).
  const { error } = await db
    .from("tas_notification")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .eq("channel", "in_app")
    .is("read_at", null);
  if (error) throw error;
}

// --- Delivery log (all channels; self-scoped by RLS) ------------------------

export async function listDeliveryLog(filter?: {
  status?: string;
  channel?: string;
}): Promise<Notification[]> {
  let query = db
    .from("tas_notification")
    .select(
      "id, recipient_user_id, type_code, channel, locale, subject, body, context_json, deep_link, source_event_id, status, read_at, sent_at, error_text, retry_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.channel) query = query.eq("channel", filter.channel);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Notification[];
}

// Admin RPC (service-role until M3.1; fails-soft for authenticated).
export async function retryNotification(id: string): Promise<void> {
  const { error } = await db.rpc("retry_notification", { p_id: id });
  if (error) throw error;
}

// --- Preferences (own rows) -------------------------------------------------

export async function listPrefs(userId: string): Promise<NotificationPref[]> {
  const { data, error } = await db
    .from("tas_notification_pref")
    .select("id, user_id, channel, type_category, enabled, is_mandatory")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as NotificationPref[];
}

// Upsert a single (user, channel, category) preference.
export async function setPref(input: {
  user_id: string;
  channel: string;
  type_category: string;
  enabled: boolean;
}): Promise<void> {
  const { error } = await db
    .from("tas_notification_pref")
    .upsert(
      {
        user_id: input.user_id,
        channel: input.channel,
        type_category: input.type_category,
        enabled: input.enabled,
      },
      { onConflict: "user_id,channel,type_category" },
    );
  if (error) throw error;
}

// --- Templates + adapter config (authenticated read) ------------------------

export async function listTemplates(): Promise<NotificationTemplate[]> {
  const { data, error } = await db
    .from("tas_notification_template")
    .select(
      "id, type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version",
    )
    .order("type_code")
    .order("channel")
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NotificationTemplate[];
}

// Admin write (service-role until M3.1; fails-soft for authenticated).
export async function updateTemplate(
  id: string,
  patch: Partial<Omit<NotificationTemplate, "id">>,
): Promise<void> {
  const { error } = await db.from("tas_notification_template").update(patch).eq("id", id);
  if (error) throw error;
}

export async function previewTemplate(
  templateId: string,
  sampleContext: Record<string, unknown>,
): Promise<RenderedTemplate> {
  const { data, error } = await db.rpc("preview_template", {
    p_template_id: templateId,
    p_sample_context: sampleContext,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return (row ?? { subject: null, body: null }) as RenderedTemplate;
}

export async function listAdapters(): Promise<CommAdapterConfig[]> {
  const { data, error } = await db
    .from("tas_comm_adapter_config")
    .select("id, channel, is_enabled, config_status, notes")
    .order("channel");
  if (error) throw error;
  return (data ?? []) as CommAdapterConfig[];
}

// --- Shared helper: degrade a read to empty on error (defensive guard). ------
export function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[notifications] query failed (showing empty):", err);
      return [];
    }
  };
}
