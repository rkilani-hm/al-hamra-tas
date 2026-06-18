-- =============================================================================
-- Al Hamra TAS — Module M0.4: Notifications RPC functions
-- =============================================================================
-- Paired with 20260618120000_m0_4_notifications.sql. SECURITY DEFINER + search_path.
-- User-facing RPCs (my_notifications, unread_count, mark_notification_read) are
-- granted to authenticated; producer/admin RPCs stay service-role until M3.1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- render_template(type_code, channel, locale, context) -> (subject, body)
-- Picks the active template and substitutes {{var}} from context. A missing var
-- renders as empty — never errors.
-- -----------------------------------------------------------------------------
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
    -- No template: return a minimal placeholder rather than failing.
    subject := p_type_code;
    body := '';
    return next;
    return;
  end if;

  -- Substitute every {{key}} present in the context.
  for v_key, v_val in select key, value #>> '{}' from jsonb_each(v_ctx) loop
    v_subject := replace(coalesce(v_subject, ''), '{{' || v_key || '}}', coalesce(v_val, ''));
    v_body    := replace(coalesce(v_body, ''),    '{{' || v_key || '}}', coalesce(v_val, ''));
  end loop;

  -- Any remaining {{...}} placeholders (missing vars) -> blank.
  v_subject := regexp_replace(coalesce(v_subject, ''), '\{\{[^}]+\}\}', '', 'g');
  v_body    := regexp_replace(coalesce(v_body, ''),    '\{\{[^}]+\}\}', '', 'g');

  subject := v_subject;
  body := v_body;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- notify(type_code, recipient_ids[], context, deep_link) -> int
-- Generic producer for non-workflow modules: renders the active in_app template
-- per recipient (in their locale) and inserts queued in_app notifications.
-- Returns the number of notifications created.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- my_notifications(user, unread_only) -> in_app notifications, newest first.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- unread_count(user) -> int
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- mark_notification_read(id) -> void  (JWT-enforced to the caller's own row)
-- -----------------------------------------------------------------------------
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
    return; -- nothing to do
  end if;

  select u.id into v_caller
  from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  -- Authenticated callers may only mark their own; service-role (no JWT) may mark any.
  if v_caller is not null and v_caller <> v_owner then
    raise exception 'cannot mark another user''s notification read';
  end if;

  update public.tas_notification set read_at = now() where id = p_id and read_at is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- preview_template(template_id, sample_context) -> (subject, body)
-- Renders a specific template (any status) for the admin live preview.
-- -----------------------------------------------------------------------------
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
  -- Preview uses English fields by default; admin can localize sample context.
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

-- -----------------------------------------------------------------------------
-- retry_notification(id) -> void  (admin/service-role): requeue a failed row.
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- EXECUTE grants
-- =============================================================================
grant execute on function public.my_notifications(uuid, boolean) to authenticated;
grant execute on function public.unread_count(uuid)              to authenticated;
grant execute on function public.mark_notification_read(uuid)    to authenticated;

-- Producer / admin RPCs stay service-role only until M3.1.
revoke execute on function public.notify(text, uuid[], jsonb, text)        from public;
revoke execute on function public.render_template(text, text, text, jsonb) from public;
revoke execute on function public.preview_template(uuid, jsonb)            from public;
revoke execute on function public.retry_notification(uuid)                 from public;

-- preview_template is needed by the template-admin UI; grant it to authenticated
-- (read-only render of templates the user can already SELECT).
grant execute on function public.preview_template(uuid, jsonb) to authenticated;

-- =============================================================================
-- End of M0.4 RPC functions.
-- =============================================================================
