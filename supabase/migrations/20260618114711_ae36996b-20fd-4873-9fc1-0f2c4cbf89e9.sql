-- =============================================================================
-- Al Hamra TAS — Module M0.5: Audit, Logging & Document Store (combined)
-- =============================================================================
create extension if not exists "pgcrypto";

create table if not exists public.tas_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.tas_user(id),
  module_code   text,
  event_type    text,
  entity_type   text,
  entity_ref    text,
  detail_json   jsonb not null default '{}',
  ip            text,
  created_at    timestamptz not null default now()
);
comment on table public.tas_audit_log is 'Append-only unified audit sink (M0.5+). Written via audit_log(); never updated/deleted.';

create index if not exists idx_tas_audit_log_actor  on public.tas_audit_log(actor_user_id, created_at);
create index if not exists idx_tas_audit_log_module on public.tas_audit_log(module_code, event_type, created_at);
create index if not exists idx_tas_audit_log_entity on public.tas_audit_log(entity_type, entity_ref);

create table if not exists public.tas_document (
  id                 uuid primary key default gen_random_uuid(),
  title              text,
  category           text check (category in
                       ('cv','certificate','civil_id','passport','visa_residency','offer_letter','other')),
  linked_entity_type text,
  linked_entity_ref  text,
  storage_provider   text not null check (storage_provider in ('sharepoint','supabase_storage')),
  storage_ref        text,
  file_name          text,
  mime_type          text,
  size_bytes         bigint,
  version            int not null default 1,
  supersedes_id      uuid references public.tas_document(id),
  status             text not null default 'active' check (status in ('active','archived')),
  uploaded_by        uuid references public.tas_user(id),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
comment on table public.tas_document is 'Document metadata. storage_ref = bucket path (supabase_storage) or Graph drive item id (sharepoint).';

create index if not exists idx_tas_document_entity      on public.tas_document(linked_entity_type, linked_entity_ref);
create index if not exists idx_tas_document_category    on public.tas_document(category, status);
create index if not exists idx_tas_document_uploader    on public.tas_document(uploaded_by);
create index if not exists idx_tas_document_supersedes  on public.tas_document(supersedes_id);

create table if not exists public.tas_storage_adapter_config (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null unique check (provider in ('sharepoint','supabase_storage')),
  is_enabled    boolean not null default false,
  config_status text not null default 'unconfigured' check (config_status in ('unconfigured','configured')),
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.tas_storage_adapter_config is 'Per-provider enable/config flags for the storage router & UI. NEVER stores secrets.';

drop trigger if exists trg_tas_document_updated_at on public.tas_document;
create trigger trg_tas_document_updated_at before update on public.tas_document
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_storage_adapter_updated_at on public.tas_storage_adapter_config;
create trigger trg_tas_storage_adapter_updated_at before update on public.tas_storage_adapter_config
  for each row execute function public.tas_set_updated_at();

create or replace view public.v_audit_unified as
  select l.id, l.actor_user_id, l.module_code, l.event_type, l.entity_type, l.entity_ref,
         l.detail_json, l.ip, l.created_at, 'audit_log'::text as source
  from public.tas_audit_log l
  union all
  select a.id, a.user_id as actor_user_id, 'M0.1/identity'::text as module_code, a.event_type,
         null::text as entity_type, null::text as entity_ref, a.detail_json, null::text as ip,
         a.created_at, 'access_audit'::text as source
  from public.tas_access_audit a;
comment on view public.v_audit_unified is 'Read-only union of tas_audit_log + tas_access_audit. source distinguishes origin.';

alter table public.tas_audit_log              enable row level security;
alter table public.tas_document               enable row level security;
alter table public.tas_storage_adapter_config enable row level security;

drop policy if exists tas_audit_log_select_auth on public.tas_audit_log;
create policy tas_audit_log_select_auth on public.tas_audit_log
  for select to authenticated using (true);

drop policy if exists tas_storage_adapter_select_auth on public.tas_storage_adapter_config;
create policy tas_storage_adapter_select_auth on public.tas_storage_adapter_config
  for select to authenticated using (true);

drop policy if exists tas_document_select_auth on public.tas_document;
create policy tas_document_select_auth on public.tas_document
  for select to authenticated using (true);

drop policy if exists tas_document_insert_self on public.tas_document;
create policy tas_document_insert_self on public.tas_document
  for insert to authenticated with check (
    uploaded_by in (
      select u.id from public.tas_user u
      where u.entra_object_id = (auth.jwt() ->> 'oid')
         or u.email = nullif(auth.jwt() ->> 'email','')::citext
    )
  );

grant select on public.tas_audit_log              to authenticated;
grant select on public.tas_storage_adapter_config to authenticated;
grant select, insert on public.tas_document       to authenticated;
grant select on public.v_audit_unified            to authenticated;

insert into public.tas_storage_adapter_config (provider, is_enabled, config_status, notes) values
  ('sharepoint',       false, 'unconfigured', 'Enable after Microsoft Graph Sites/Drives credentials are set.'),
  ('supabase_storage', true,  'configured',   'Built-in fallback. Private bucket: tas-documents.')
on conflict (provider) do nothing;

insert into public.tas_lookup (lookup_type, code, name_en, name_ar, sort_order) values
  ('document_category', 'cv',             'CV / Resume',     'السيرة الذاتية',       1),
  ('document_category', 'certificate',    'Certificate',     'شهادة',                2),
  ('document_category', 'civil_id',       'Civil ID',        'البطاقة المدنية',      3),
  ('document_category', 'passport',       'Passport',        'جواز السفر',           4),
  ('document_category', 'visa_residency', 'Visa / Residency','التأشيرة / الإقامة',   5),
  ('document_category', 'offer_letter',   'Offer Letter',    'خطاب العرض',           6),
  ('document_category', 'other',          'Other',           'أخرى',                 7)
on conflict (lookup_type, code) do nothing;

-- ===== RPC FUNCTIONS =====
create or replace function public.audit_log(
  p_actor uuid, p_module text, p_event_type text, p_entity_type text, p_entity_ref text, p_detail jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.tas_audit_log (actor_user_id, module_code, event_type, entity_type, entity_ref, detail_json)
  values (p_actor, p_module, p_event_type, p_entity_type, p_entity_ref, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.search_audit(
  p_actor uuid default null, p_module text default null, p_event_type text default null,
  p_from timestamptz default null, p_to timestamptz default null,
  p_entity_type text default null, p_entity_ref text default null,
  p_limit int default 50, p_offset int default 0
) returns table(
  id uuid, actor_user_id uuid, module_code text, event_type text, entity_type text,
  entity_ref text, detail_json jsonb, ip text, created_at timestamptz, source text
) language sql stable security definer set search_path = public as $$
  select v.id, v.actor_user_id, v.module_code, v.event_type, v.entity_type,
         v.entity_ref, v.detail_json, v.ip, v.created_at, v.source
  from public.v_audit_unified v
  where (p_actor       is null or v.actor_user_id = p_actor)
    and (p_module      is null or v.module_code   = p_module)
    and (p_event_type  is null or v.event_type    = p_event_type)
    and (p_from        is null or v.created_at    >= p_from)
    and (p_to          is null or v.created_at    <= p_to)
    and (p_entity_type is null or v.entity_type   = p_entity_type)
    and (p_entity_ref  is null or v.entity_ref    = p_entity_ref)
  order by v.created_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.list_documents(p_entity_type text, p_entity_ref text)
returns table(
  id uuid, title text, category text, linked_entity_type text, linked_entity_ref text,
  storage_provider text, storage_ref text, file_name text, mime_type text, size_bytes bigint,
  version int, supersedes_id uuid, status text, uploaded_by uuid, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select d.id, d.title, d.category, d.linked_entity_type, d.linked_entity_ref,
         d.storage_provider, d.storage_ref, d.file_name, d.mime_type, d.size_bytes,
         d.version, d.supersedes_id, d.status, d.uploaded_by, d.created_at
  from public.tas_document d
  where d.status = 'active'
    and (p_entity_type is null or d.linked_entity_type = p_entity_type)
    and (p_entity_ref  is null or d.linked_entity_ref  = p_entity_ref)
  order by d.version desc, d.created_at desc;
$$;

create or replace function public.document_versions(p_id uuid)
returns table(
  id uuid, title text, version int, supersedes_id uuid, status text, file_name text, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select d.id, d.supersedes_id, array[d.id] as visited
    from public.tas_document d
    where d.id = p_id
    union all
    select d.id, d.supersedes_id, c.visited || d.id
    from public.tas_document d
    join chain c
      on (d.id = c.supersedes_id or d.supersedes_id = c.id)
    where d.id <> all(c.visited)
  )
  select distinct d.id, d.title, d.version, d.supersedes_id, d.status, d.file_name, d.created_at
  from public.tas_document d
  join chain c on c.id = d.id
  order by d.version desc;
$$;

create or replace function public.archive_document(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_doc public.tas_document;
begin
  select * into v_doc from public.tas_document where id = p_id;
  if v_doc is null then return; end if;

  select u.id into v_caller
  from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_document set status = 'archived', updated_by = v_caller where id = p_id;

  perform public.audit_log(
    v_caller, 'M0.5', 'document.archived', v_doc.linked_entity_type, v_doc.linked_entity_ref,
    jsonb_build_object('document_id', p_id, 'file_name', v_doc.file_name)
  );
end; $$;

grant execute on function public.search_audit(uuid, text, text, timestamptz, timestamptz, text, text, int, int) to authenticated;
grant execute on function public.list_documents(text, text)    to authenticated;
grant execute on function public.document_versions(uuid)       to authenticated;
revoke execute on function public.audit_log(uuid, text, text, text, text, jsonb) from public;
revoke execute on function public.archive_document(uuid)       from public;
grant execute on function public.archive_document(uuid)        to authenticated;
