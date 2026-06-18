-- =============================================================================
-- Al Hamra TAS — Module M0.4: Notifications & Communications
-- =============================================================================
-- A central notification engine. IN-APP works with zero external deps. Email /
-- Teams / SMS are PLUGGABLE ADAPTERS that no-op gracefully ('skipped') until
-- their secrets/config exist. Consumes M0.3's tas_workflow_event rows and offers
-- a generic notify() for other modules. Degradation is a feature: a missing
-- adapter yields status 'skipped' — never 'failed', never a crash.
--
-- Conventions (M0.1–M0.3): UUID PKs, audit cols + tas_set_updated_at() trigger,
-- bilingual fields, status checks, FK + dispatch-hot indexes.
--
-- -----------------------------------------------------------------------------
-- RLS posture (M0.4; per-role tightening in M3.1):
--   * tas_notification: authenticated SELECT + UPDATE of OWN rows (recipient);
--     other writes service-role. (Own-row UPDATE is for mark-read; M3.1 narrows
--     it to the read_at column.)
--   * tas_notification_template, tas_comm_adapter_config: authenticated SELECT;
--     writes service-role.
--   * tas_notification_pref: authenticated SELECT + INSERT/UPDATE of OWN rows.
-- -----------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Bilingual, versioned message template per (type_code, channel).
create table if not exists public.tas_notification_template (
  id             uuid primary key default gen_random_uuid(),
  type_code      text not null,
  channel        text not null check (channel in ('in_app','outlook_email','teams','sms')),
  subject_en     text,
  subject_ar     text,
  body_en        text,
  body_ar        text,
  variables_json jsonb not null default '[]',
  status         text not null default 'draft' check (status in ('draft','active','archived')),
  version        int not null default 1,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (type_code, channel, version)
);
comment on table public.tas_notification_template is 'Bilingual message templates. {{var}} placeholders resolved from context at render time.';

-- One active template per (type_code, channel).
create unique index if not exists uq_tas_notif_template_active
  on public.tas_notification_template (type_code, channel)
  where status = 'active';

-- A rendered, channel-bound message addressed to a recipient.
create table if not exists public.tas_notification (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.tas_user(id),
  type_code         text not null,
  channel           text not null check (channel in ('in_app','outlook_email','teams','sms')),
  locale            text not null default 'en' check (locale in ('en','ar')),
  subject           text,
  body              text,
  context_json      jsonb not null default '{}',
  deep_link         text,
  source_event_id   uuid references public.tas_workflow_event(id),
  status            text not null default 'queued'
                      check (status in ('queued','sent','skipped','failed','failed_terminal')),
  read_at           timestamptz,
  sent_at           timestamptz,
  error_text        text,
  retry_count       int not null default 0,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
comment on table public.tas_notification is 'Rendered message per recipient+channel. in_app is delivered by being read; external channels by adapters.';

-- Idempotency: never double-create for the same (source_event, recipient, channel).
create unique index if not exists uq_tas_notif_event_recipient_channel
  on public.tas_notification (source_event_id, recipient_user_id, channel)
  where source_event_id is not null;

-- Per-user channel/category preferences (absence = enabled).
create table if not exists public.tas_notification_pref (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.tas_user(id) on delete cascade,
  channel       text not null,
  type_category text not null,
  enabled       boolean not null default true,
  is_mandatory  boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  unique (user_id, channel, type_category)
);
comment on table public.tas_notification_pref is 'Per-user opt-out. Row absence = enabled. is_mandatory categories cannot be disabled.';

-- Adapter status flags (NEVER store secrets here — only en/disabled + config status).
create table if not exists public.tas_comm_adapter_config (
  id            uuid primary key default gen_random_uuid(),
  channel       text not null unique check (channel in ('in_app','outlook_email','teams','sms')),
  is_enabled    boolean not null default false,
  config_status text not null default 'unconfigured' check (config_status in ('unconfigured','configured')),
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.tas_comm_adapter_config is 'Per-channel enable/config flags for the dispatcher & UI. NEVER stores secrets (those live in Supabase/Lovable env).';

-- =============================================================================
-- 2. INDEXES
-- =============================================================================
create index if not exists idx_tas_notif_recipient   on public.tas_notification(recipient_user_id, status);
create index if not exists idx_tas_notif_status       on public.tas_notification(status, channel);
create index if not exists idx_tas_notif_unread       on public.tas_notification(recipient_user_id, read_at);
create index if not exists idx_tas_notif_source_event on public.tas_notification(source_event_id);
create index if not exists idx_tas_notif_template_lookup on public.tas_notification_template(type_code, channel, status);
create index if not exists idx_tas_notif_pref_user    on public.tas_notification_pref(user_id);

-- =============================================================================
-- 3. updated_at TRIGGERS (reuse public.tas_set_updated_at())
-- =============================================================================
drop trigger if exists trg_tas_notif_template_updated_at on public.tas_notification_template;
create trigger trg_tas_notif_template_updated_at before update on public.tas_notification_template
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_notif_updated_at on public.tas_notification;
create trigger trg_tas_notif_updated_at before update on public.tas_notification
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_notif_pref_updated_at on public.tas_notification_pref;
create trigger trg_tas_notif_pref_updated_at before update on public.tas_notification_pref
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_comm_adapter_updated_at on public.tas_comm_adapter_config;
create trigger trg_tas_comm_adapter_updated_at before update on public.tas_comm_adapter_config
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================
alter table public.tas_notification_template enable row level security;
alter table public.tas_notification          enable row level security;
alter table public.tas_notification_pref     enable row level security;
alter table public.tas_comm_adapter_config   enable row level security;

-- Caller's tas_user resolved by Entra oid/email (same pattern as M0.3).
-- Templates + adapter config: readable by authenticated; writes service-role.
drop policy if exists tas_notif_template_select_auth on public.tas_notification_template;
create policy tas_notif_template_select_auth on public.tas_notification_template
  for select to authenticated using (true);

drop policy if exists tas_comm_adapter_select_auth on public.tas_comm_adapter_config;
create policy tas_comm_adapter_select_auth on public.tas_comm_adapter_config
  for select to authenticated using (true);

-- Notifications: recipient may read + update own rows (mark-read). M3.1 narrows
-- the UPDATE to the read_at column.
drop policy if exists tas_notif_select_self on public.tas_notification;
create policy tas_notif_select_self on public.tas_notification
  for select to authenticated using (
    recipient_user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

drop policy if exists tas_notif_update_self on public.tas_notification;
create policy tas_notif_update_self on public.tas_notification
  for update to authenticated using (
    recipient_user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  ) with check (
    recipient_user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

-- Preferences: user manages own rows (select/insert/update).
drop policy if exists tas_notif_pref_select_self on public.tas_notification_pref;
create policy tas_notif_pref_select_self on public.tas_notification_pref
  for select to authenticated using (
    user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

drop policy if exists tas_notif_pref_insert_self on public.tas_notification_pref;
create policy tas_notif_pref_insert_self on public.tas_notification_pref
  for insert to authenticated with check (
    user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

drop policy if exists tas_notif_pref_update_self on public.tas_notification_pref;
create policy tas_notif_pref_update_self on public.tas_notification_pref
  for update to authenticated using (
    user_id in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

-- =============================================================================
-- 5. GRANTS (per-role tightening in M3.1)
-- =============================================================================
grant select on public.tas_notification_template to authenticated;
grant select on public.tas_comm_adapter_config   to authenticated;
grant select, update on public.tas_notification  to authenticated;          -- update = mark-read (own rows via RLS)
grant select, insert, update on public.tas_notification_pref to authenticated;

-- =============================================================================
-- 6. SEED (idempotent — ON CONFLICT DO NOTHING)
-- =============================================================================

-- 6a. Adapter config: in_app live; external channels unconfigured.
insert into public.tas_comm_adapter_config (channel, is_enabled, config_status, notes) values
  ('in_app',        true,  'configured',   'Built-in. Always available.'),
  ('outlook_email', false, 'unconfigured', 'Enable after Microsoft Graph Mail.Send credentials are set.'),
  ('teams',         false, 'unconfigured', 'Enable after Microsoft Graph Teams credentials are set.'),
  ('sms',           false, 'unconfigured', 'Enable after SMS gateway URL/key are set.')
on conflict (channel) do nothing;

-- 6b. Active in_app templates for the 7 workflow event type_codes (bilingual).
insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('workflow.task_created', 'in_app',
   'Approval needed: {{request_type}} {{request_ref}}',
   'مطلوب اعتماد: {{request_type}} {{request_ref}}',
   'You have a pending approval for {{request_type}} ({{request_ref}}) at step "{{step_name}}".',
   'لديك اعتماد معلّق لـ {{request_type}} ({{request_ref}}) في الخطوة "{{step_name}}".',
   '["request_type","request_ref","step_name"]', 'active', 1),

  ('workflow.step_advanced', 'in_app',
   'Advanced: {{request_type}} {{request_ref}}',
   'تم التقدّم: {{request_type}} {{request_ref}}',
   '{{request_type}} ({{request_ref}}) advanced to step "{{step_name}}".',
   'انتقل {{request_type}} ({{request_ref}}) إلى الخطوة "{{step_name}}".',
   '["request_type","request_ref","step_name"]', 'active', 1),

  ('workflow.instance_completed', 'in_app',
   'Approved: {{request_type}} {{request_ref}}',
   'تم الاعتماد: {{request_type}} {{request_ref}}',
   'Your request {{request_type}} ({{request_ref}}) has been fully approved.',
   'تمت الموافقة الكاملة على طلبك {{request_type}} ({{request_ref}}).',
   '["request_type","request_ref"]', 'active', 1),

  ('workflow.rejected', 'in_app',
   'Rejected: {{request_type}} {{request_ref}}',
   'مرفوض: {{request_type}} {{request_ref}}',
   'Your request {{request_type}} ({{request_ref}}) was rejected.',
   'تم رفض طلبك {{request_type}} ({{request_ref}}).',
   '["request_type","request_ref"]', 'active', 1),

  ('workflow.returned', 'in_app',
   'Returned: {{request_type}} {{request_ref}}',
   'مُعاد: {{request_type}} {{request_ref}}',
   'Your request {{request_type}} ({{request_ref}}) was returned for changes.',
   'أُعيد طلبك {{request_type}} ({{request_ref}}) لإجراء تعديلات.',
   '["request_type","request_ref"]', 'active', 1),

  ('workflow.escalated', 'in_app',
   'Escalated: {{request_type}} {{request_ref}}',
   'تم التصعيد: {{request_type}} {{request_ref}}',
   'An approval for {{request_type}} ({{request_ref}}) is overdue and has been escalated.',
   'تجاوز اعتماد {{request_type}} ({{request_ref}}) موعده وتم تصعيده.',
   '["request_type","request_ref","step_name"]', 'active', 1),

  ('workflow.blocked', 'in_app',
   'Blocked: {{request_type}} {{request_ref}}',
   'محظور: {{request_type}} {{request_ref}}',
   '{{request_type}} ({{request_ref}}) is blocked: no approver could be resolved at step "{{step_name}}".',
   'تم حظر {{request_type}} ({{request_ref}}): تعذّر تحديد معتمِد في الخطوة "{{step_name}}".',
   '["request_type","request_ref","step_name"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- 6c. outlook_email versions for task_created + escalated (render-ready once configured).
insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('workflow.task_created', 'outlook_email',
   'Action required: {{request_type}} {{request_ref}}',
   'إجراء مطلوب: {{request_type}} {{request_ref}}',
   'Dear approver,\n\nA request {{request_type}} ({{request_ref}}) awaits your approval at step "{{step_name}}".\nPlease review it in Al Hamra TAS.',
   'عزيزي المعتمِد،\n\nيوجد طلب {{request_type}} ({{request_ref}}) بانتظار اعتمادك في الخطوة "{{step_name}}".\nيرجى مراجعته في نظام الحمراء.',
   '["request_type","request_ref","step_name"]', 'active', 1),

  ('workflow.escalated', 'outlook_email',
   'Overdue approval escalated: {{request_type}} {{request_ref}}',
   'تصعيد اعتماد متأخر: {{request_type}} {{request_ref}}',
   'Dear approver,\n\nThe approval for {{request_type}} ({{request_ref}}) at step "{{step_name}}" is overdue and has been escalated.',
   'عزيزي المعتمِد،\n\nتجاوز اعتماد {{request_type}} ({{request_ref}}) في الخطوة "{{step_name}}" موعده وتم تصعيده.',
   '["request_type","request_ref","step_name"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- =============================================================================
-- End of schema/seed. RPC functions follow in 20260618120001_m0_4_notifications_rpc.sql
-- =============================================================================
