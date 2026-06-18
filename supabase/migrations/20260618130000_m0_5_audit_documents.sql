-- =============================================================================
-- Al Hamra TAS — Module M0.5: Audit, Logging & Document Store
-- =============================================================================
-- Two halves:
--   (1) UNIFIED AUDIT: a broad append-only tas_audit_log + audit_log() writer +
--       a v_audit_unified VIEW that UNIONs the existing tas_access_audit with
--       tas_audit_log. NON-DESTRUCTIVE: tas_access_audit rows are never altered
--       or migrated — the view just reads both.
--   (2) DOCUMENT STORE: tas_document metadata + a storage-adapter abstraction
--       (SharePoint via Graph, dormant until secrets) with a Supabase Storage
--       FALLBACK so upload/download works today. Degradation is a feature.
--
-- -----------------------------------------------------------------------------
-- ⚠️  STORAGE BUCKET REQUIREMENT (action for Lovable on apply):
--     The Supabase Storage fallback needs a PRIVATE bucket named 'tas-documents'.
--     This migration ATTEMPTS an idempotent insert into storage.buckets (wrapped
--     so it is harmless if storage isn't manageable via SQL). If that no-ops,
--     Lovable MUST provision/confirm a PRIVATE bucket named 'tas-documents'
--     during apply. The document-upload/download edge functions assume it exists.
-- -----------------------------------------------------------------------------
--
-- RLS posture (M0.5; per-role tightening in M3.1):
--   * tas_audit_log: authenticated SELECT; INSERT service-role; APPEND-ONLY
--     (no update/delete policy ever).
--   * tas_document: authenticated SELECT; authenticated INSERT of own rows
--     (uploaded_by = caller via Entra oid/email); update/archive/delete service-role.
--   * tas_storage_adapter_config: authenticated SELECT; writes service-role.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Broad, append-only audit log. THE forward-going audit sink (via audit_log()).
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

-- Document metadata. Bytes live in storage (SharePoint or Supabase Storage).
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

create index if not exists idx_tas_document_entity  on public.tas_document(linked_entity_type, linked_entity_ref);
create index if not exists idx_tas_document_category on public.tas_document(category, status);
create index if not exists idx_tas_document_uploader on public.tas_document(uploaded_by);
create index if not exists idx_tas_document_supersedes on public.tas_document(supersedes_id);

-- Storage adapter status flags (NEVER secrets — mirrors M0.4 adapter config).
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

-- =============================================================================
-- 2. updated_at TRIGGERS (document + adapter config; audit_log is append-only)
-- =============================================================================
drop trigger if exists trg_tas_document_updated_at on public.tas_document;
create trigger trg_tas_document_updated_at before update on public.tas_document
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_storage_adapter_updated_at on public.tas_storage_adapter_config;
create trigger trg_tas_storage_adapter_updated_at before update on public.tas_storage_adapter_config
  for each row execute function public.tas_set_updated_at();

-- =============================================================================
-- 3. UNIFIED AUDIT VIEW (non-destructive UNION; never alters base rows)
-- =============================================================================
-- tas_access_audit columns (verified): id, user_id, event_type, detail_json, created_at.
-- Mapped onto the audit_log shape; module_code labelled, entity_type/ref/ip null.
create or replace view public.v_audit_unified as
  select
    l.id,
    l.actor_user_id,
    l.module_code,
    l.event_type,
    l.entity_type,
    l.entity_ref,
    l.detail_json,
    l.ip,
    l.created_at,
    'audit_log'::text as source
  from public.tas_audit_log l
  union all
  select
    a.id,
    a.user_id        as actor_user_id,
    'M0.1/identity'::text as module_code,
    a.event_type,
    null::text       as entity_type,
    null::text       as entity_ref,
    a.detail_json,
    null::text       as ip,
    a.created_at,
    'access_audit'::text as source
  from public.tas_access_audit a;
comment on view public.v_audit_unified is 'Read-only union of tas_audit_log + tas_access_audit. `source` distinguishes origin. Inherits RLS from base tables.';

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================
alter table public.tas_audit_log              enable row level security;
alter table public.tas_document               enable row level security;
alter table public.tas_storage_adapter_config enable row level security;

-- Audit log: authenticated may read (auditor/admin scope tightened in M3.1).
-- INSERT is service-role only (via audit_log()). NO update/delete policy => the
-- table is append-only for every non-superuser role.
drop policy if exists tas_audit_log_select_auth on public.tas_audit_log;
create policy tas_audit_log_select_auth on public.tas_audit_log
  for select to authenticated using (true);

-- Adapter config: authenticated read; writes service-role.
drop policy if exists tas_storage_adapter_select_auth on public.tas_storage_adapter_config;
create policy tas_storage_adapter_select_auth on public.tas_storage_adapter_config
  for select to authenticated using (true);

-- Documents: authenticated read; insert own rows (uploaded_by = caller).
-- Update/soft-delete/hard-delete are service-role only (archive via RPC).
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

-- =============================================================================
-- 5. GRANTS (per-role tightening in M3.1)
-- =============================================================================
grant select on public.tas_audit_log              to authenticated;
grant select on public.tas_storage_adapter_config to authenticated;
grant select, insert on public.tas_document       to authenticated;
grant select on public.v_audit_unified            to authenticated;

-- =============================================================================
-- 6. SEED (idempotent — ON CONFLICT DO NOTHING)
-- =============================================================================

-- 6a. Storage adapters: SharePoint dormant; Supabase Storage live.
insert into public.tas_storage_adapter_config (provider, is_enabled, config_status, notes) values
  ('sharepoint',       false, 'unconfigured', 'Enable after Microsoft Graph Sites/Drives credentials are set.'),
  ('supabase_storage', true,  'configured',   'Built-in fallback. Private bucket: tas-documents.')
on conflict (provider) do nothing;

-- 6b. Document categories in tas_lookup (bilingual), matching the category enum.
insert into public.tas_lookup (lookup_type, code, name_en, name_ar, sort_order) values
  ('document_category', 'cv',             'CV / Resume',     'السيرة الذاتية',       1),
  ('document_category', 'certificate',    'Certificate',     'شهادة',                2),
  ('document_category', 'civil_id',       'Civil ID',        'البطاقة المدنية',      3),
  ('document_category', 'passport',       'Passport',        'جواز السفر',           4),
  ('document_category', 'visa_residency', 'Visa / Residency','التأشيرة / الإقامة',   5),
  ('document_category', 'offer_letter',   'Offer Letter',    'خطاب العرض',           6),
  ('document_category', 'other',          'Other',           'أخرى',                 7)
on conflict (lookup_type, code) do nothing;

-- =============================================================================
-- 7. STORAGE BUCKET (best-effort; see header). Harmless if storage schema differs.
-- =============================================================================
-- Attempt to create the private 'tas-documents' bucket idempotently. Wrapped in a
-- DO block so any permission/schema difference is swallowed — Lovable confirms
-- the bucket on apply regardless.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('tas-documents', 'tas-documents', false)
    on conflict (id) do nothing;
  end if;
exception when others then
  raise notice 'tas-documents bucket not created via SQL (provision it in Lovable): %', sqlerrm;
end $$;

-- =============================================================================
-- End of schema/seed. RPC functions follow in 20260618130001_m0_5_audit_documents_rpc.sql
-- =============================================================================
