// Module M0.4 — Notifications & Communications: TypeScript types.
// Mirrors supabase/migrations/20260618120000_m0_4_notifications.sql + RPC shapes.

export type Channel = "in_app" | "outlook_email" | "teams" | "sms";
export type TemplateStatus = "draft" | "active" | "archived";
export type NotificationStatus =
  | "queued"
  | "sent"
  | "skipped"
  | "failed"
  | "failed_terminal";
export type AppLocale = "en" | "ar";
export type AdapterConfigStatus = "unconfigured" | "configured";

export const CHANNELS: Channel[] = ["in_app", "outlook_email", "teams", "sms"];
export const EXTERNAL_CHANNELS: Channel[] = ["outlook_email", "teams", "sms"];

// The 7 seeded workflow template type_codes.
export const WORKFLOW_TYPE_CODES = [
  "workflow.task_created",
  "workflow.step_advanced",
  "workflow.instance_completed",
  "workflow.rejected",
  "workflow.returned",
  "workflow.escalated",
  "workflow.blocked",
] as const;

// --- Tables -----------------------------------------------------------------
export interface NotificationTemplate {
  id: string;
  type_code: string;
  channel: Channel;
  subject_en: string | null;
  subject_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  variables_json: string[];
  status: TemplateStatus;
  version: number;
}

export interface Notification {
  id: string;
  recipient_user_id: string | null;
  type_code: string;
  channel: Channel;
  locale: AppLocale;
  subject: string | null;
  body: string | null;
  context_json: Record<string, unknown>;
  deep_link: string | null;
  source_event_id: string | null;
  status: NotificationStatus;
  read_at: string | null;
  sent_at: string | null;
  error_text: string | null;
  retry_count: number;
  created_at: string;
}

export interface NotificationPref {
  id: string;
  user_id: string;
  channel: string;
  type_category: string;
  enabled: boolean;
  is_mandatory: boolean;
}

export interface CommAdapterConfig {
  id: string;
  channel: Channel;
  is_enabled: boolean;
  config_status: AdapterConfigStatus;
  notes: string | null;
}

// --- RPC view models --------------------------------------------------------

// my_notifications(p_user_id, p_unread_only)
export interface InAppNotification {
  id: string;
  type_code: string;
  subject: string | null;
  body: string | null;
  deep_link: string | null;
  locale: AppLocale;
  read_at: string | null;
  created_at: string;
}

// render_template / preview_template
export interface RenderedTemplate {
  subject: string | null;
  body: string | null;
}

// Preference categories surfaced in the UI (extend as modules add notifications).
export const PREF_CATEGORIES = ["workflow"] as const;
export type PrefCategory = (typeof PREF_CATEGORIES)[number];
