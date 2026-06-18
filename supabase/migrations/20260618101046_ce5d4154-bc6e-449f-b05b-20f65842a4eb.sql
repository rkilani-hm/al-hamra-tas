-- =============================================================================
-- Al Hamra TAS — Module M0.4: Notifications & Communications
-- =============================================================================

create extension if not exists "pgcrypto";

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

create unique index if not exists uq_tas_notif_template_active
  on public.tas_notification_template (type_code, channel)
  where status = 'active';

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

create unique index if not exists uq_tas_notif_event_recipient_channel
  on public.tas_notification (source_event_id, recipient_user_id, channel)
  where source_event_id is not null;

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

create index if not exists idx_tas_notif_recipient   on public.tas_notification(recipient_user_id, status);
create index if not exists idx_tas_notif_status       on public.tas_notification(status, channel);
create index if not exists idx_tas_notif_unread       on public.tas_notification(recipient_user_id, read_at);
create index if not exists idx_tas_notif_source_event on public.tas_notification(source_event_id);
create index if not exists idx_tas_notif_template_lookup on public.tas_notification_template(type_code, channel, status);
create index if not exists idx_tas_notif_pref_user    on public.tas_notification_pref(user_id);

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

alter table public.tas_notification_template enable row level security;
alter table public.tas_notification          enable row level security;
alter table public.tas_notification_pref     enable row level security;
alter table public.tas_comm_adapter_config   enable row level security;

drop policy if exists tas_notif_template_select_auth on public.tas_notification_template;
create policy tas_notif_template_select_auth on public.tas_notification_template
  for select to authenticated using (true);

drop policy if exists tas_comm_adapter_select_auth on public.tas_comm_adapter_config;
create policy tas_comm_adapter_select_auth on public.tas_comm_adapter_config
  for select to authenticated using (true);

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

grant select on public.tas_notification_template to authenticated;
grant select on public.tas_comm_adapter_config   to authenticated;
grant select, update on public.tas_notification  to authenticated;
grant select, insert, update on public.tas_notification_pref to authenticated;

insert into public.tas_comm_adapter_config (channel, is_enabled, config_status, notes) values
  ('in_app',        true,  'configured',   'Built-in. Always available.'),
  ('outlook_email', false, 'unconfigured', 'Enable after Microsoft Graph Mail.Send credentials are set.'),
  ('teams',         false, 'unconfigured', 'Enable after Microsoft Graph Teams credentials are set.'),
  ('sms',           false, 'unconfigured', 'Enable after SMS gateway URL/key are set.')
on conflict (channel) do nothing;

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

insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('workflow.task_created', 'outlook_email',
   'Action required: {{request_type}} {{request_ref}}',
   'إجراء مطلوب: {{request_type}} {{request_ref}}',
   E'Dear approver,\n\nA request {{request_type}} ({{request_ref}}) awaits your approval at step "{{step_name}}".\nPlease review it in Al Hamra TAS.',
   E'عزيزي المعتمِد،\n\nيوجد طلب {{request_type}} ({{request_ref}}) بانتظار اعتمادك في الخطوة "{{step_name}}".\nيرجى مراجعته في نظام الحمراء.',
   '["request_type","request_ref","step_name"]', 'active', 1),
  ('workflow.escalated', 'outlook_email',
   'Overdue approval escalated: {{request_type}} {{request_ref}}',
   'تصعيد اعتماد متأخر: {{request_type}} {{request_ref}}',
   E'Dear approver,\n\nThe approval for {{request_type}} ({{request_ref}}) at step "{{step_name}}" is overdue and has been escalated.',
   E'عزيزي المعتمِد،\n\nتجاوز اعتماد {{request_type}} ({{request_ref}}) في الخطوة "{{step_name}}" موعده وتم تصعيده.',
   '["request_type","request_ref","step_name"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;

-- =============================================================================
-- M0.4 RPC functions
-- =============================================================================

create or replace function public.render_template(
  p_type_code text,
  p_channel   text,
  p_locale    text,
  p_context   jsonb
)
returns table(subject text, body text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_body    text;
  v_key     text;
  v_val     text;
  v_ctx     jsonb := coalesce(p_context, '{}'::jsonb);
begin
  select
    case when p_locale = 'ar' then coalesce(t.subject_ar, t.subject_en) else coalesce(t.subject_en, t.subject_ar) end,
    case when p_locale = 'ar' then coalesce(t.body_ar, t.body_en)       else coalesce(t.body_en, t.body_ar)       end
  into v_subject, v_body
  from public.tas_notification_template t
  where t.type_code = p_type_code and t.channel = p_channel and t.status = 'active'
  order by t.version desc
  limit 1;

  if v_subject is null and v_body is null then
    subject := p_type_code;
    body := '';
    return next;
    return;
  end if;

  for v_key, v_val in select key, value #>> '{}' from jsonb_each(v_ctx) loop
    v_subject := replace(coalesce(v_subject, ''), '{{' || v_key || '}}', coalesce(v_val, ''));
    v_body    := replace(coalesce(v_body, ''),    '{{' || v_key || '}}', coalesce(v_val, ''));
  end loop;

  v_subject := regexp_replace(coalesce(v_subject, ''), '\{\{[^}]+\}\}', '', 'g');
  v_body    := regexp_replace(coalesce(v_body, ''),    '\{\{[^}]+\}\}', '', 'g');

  subject := v_subject;
  body := v_body;
  return next;
end;
$$;

create or replace function public.notify(
  p_type_code     text,
  p_recipient_ids uuid[],
  p_context       jsonb,
  p_deep_link     text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid;
  v_locale  text;
  v_subject text;
  v_body    text;
  v_count   int := 0;
begin
  if p_recipient_ids is null then
    return 0;
  end if;

  foreach v_uid in array p_recipient_ids loop
    if v_uid is null then continue; end if;

    select coalesce(default_locale, 'en') into v_locale from public.tas_user where id = v_uid;
    v_locale := coalesce(v_locale, 'en');

    select r.subject, r.body into v_subject, v_body
    from public.render_template(p_type_code, 'in_app', v_locale, coalesce(p_context, '{}'::jsonb)) r;

    insert into public.tas_notification
      (recipient_user_id, type_code, channel, locale, subject, body, context_json, deep_link, status)
    values
      (v_uid, p_type_code, 'in_app', v_locale, v_subject, v_body,
       coalesce(p_context, '{}'::jsonb), p_deep_link, 'queued');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.my_notifications(p_user_id uuid, p_unread_only boolean default false)
returns table(
  id           uuid,
  type_code    text,
  subject      text,
  body         text,
  deep_link    text,
  locale       text,
  read_at      timestamptz,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.type_code, n.subject, n.body, n.deep_link, n.locale, n.read_at, n.created_at
  from public.tas_notification n
  where n.recipient_user_id = p_user_id
    and n.channel = 'in_app'
    and (not p_unread_only or n.read_at is null)
  order by n.created_at desc;
$$;

create or replace function public.unread_count(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.tas_notification n
  where n.recipient_user_id = p_user_id
    and n.channel = 'in_app'
    and n.read_at is null;
$$;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_owner  uuid;
begin
  select recipient_user_id into v_owner from public.tas_notification where id = p_id;
  if v_owner is null then
    return;
  end if;

  select u.id into v_caller
  from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if v_caller is not null and v_caller <> v_owner then
    raise exception 'cannot mark another user''s notification read';
  end if;

  update public.tas_notification set read_at = now() where id = p_id and read_at is null;
end;
$$;

create or replace function public.preview_template(p_template_id uuid, p_sample_context jsonb)
returns table(subject text, body text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subject text;
  v_body    text;
  v_key     text;
  v_val     text;
  v_ctx     jsonb := coalesce(p_sample_context, '{}'::jsonb);
begin
  select coalesce(subject_en, subject_ar), coalesce(body_en, body_ar)
  into v_subject, v_body
  from public.tas_notification_template where id = p_template_id;

  for v_key, v_val in select key, value #>> '{}' from jsonb_each(v_ctx) loop
    v_subject := replace(coalesce(v_subject, ''), '{{' || v_key || '}}', coalesce(v_val, ''));
    v_body    := replace(coalesce(v_body, ''),    '{{' || v_key || '}}', coalesce(v_val, ''));
  end loop;
  v_subject := regexp_replace(coalesce(v_subject, ''), '\{\{[^}]+\}\}', '', 'g');
  v_body    := regexp_replace(coalesce(v_body, ''),    '\{\{[^}]+\}\}', '', 'g');

  subject := v_subject;
  body := v_body;
  return next;
end;
$$;

create or replace function public.retry_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int := 5;
begin
  update public.tas_notification
    set status = 'queued', error_text = null
    where id = p_id
      and status in ('failed','failed_terminal')
      and retry_count < v_max;
end;
$$;

grant execute on function public.my_notifications(uuid, boolean) to authenticated;
grant execute on function public.unread_count(uuid)              to authenticated;
grant execute on function public.mark_notification_read(uuid)    to authenticated;

revoke execute on function public.notify(text, uuid[], jsonb, text)        from public;
revoke execute on function public.render_template(text, text, text, jsonb) from public;
revoke execute on function public.preview_template(uuid, jsonb)            from public;
revoke execute on function public.retry_notification(uuid)                 from public;

grant execute on function public.preview_template(uuid, jsonb) to authenticated;