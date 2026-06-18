-- =============================================================================
-- Al Hamra TAS — Module M0.5: Audit & Documents RPC functions
-- =============================================================================
-- Paired with 20260618130000_m0_5_audit_documents.sql. SECURITY DEFINER + search_path.
-- Read RPCs (search_audit, list_documents, document_versions) granted to
-- authenticated; the writer (audit_log) + archive_document stay service-role/admin
-- until M3.1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_log(...) -> uuid : THE forward-going append-only audit writer.
-- -----------------------------------------------------------------------------
create or replace function public.audit_log(
  p_actor       uuid,
  p_module      text,
  p_event_type  text,
  p_entity_type text,
  p_entity_ref  text,
  p_detail      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.tas_audit_log
    (actor_user_id, module_code, event_type, entity_type, entity_ref, detail_json)
  values
    (p_actor, p_module, p_event_type, p_entity_type, p_entity_ref, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- search_audit(...) -> paged rows over v_audit_unified (null filters = ignore).
-- -----------------------------------------------------------------------------
create or replace function public.search_audit(
  p_actor       uuid    default null,
  p_module      text    default null,
  p_event_type  text    default null,
  p_from        timestamptz default null,
  p_to          timestamptz default null,
  p_entity_type text    default null,
  p_entity_ref  text    default null,
  p_limit       int     default 50,
  p_offset      int     default 0
)
returns table(
  id            uuid,
  actor_user_id uuid,
  module_code   text,
  event_type    text,
  entity_type   text,
  entity_ref    text,
  detail_json   jsonb,
  ip            text,
  created_at    timestamptz,
  source        text
)
language sql
stable
security definer
set search_path = public
as $$
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

-- -----------------------------------------------------------------------------
-- list_documents(entity_type, entity_ref) -> active docs, newest version first.
-- -----------------------------------------------------------------------------
create or replace function public.list_documents(p_entity_type text, p_entity_ref text)
returns table(
  id                 uuid,
  title              text,
  category           text,
  linked_entity_type text,
  linked_entity_ref  text,
  storage_provider   text,
  storage_ref        text,
  file_name          text,
  mime_type          text,
  size_bytes         bigint,
  version            int,
  supersedes_id      uuid,
  status             text,
  uploaded_by        uuid,
  created_at         timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.title, d.category, d.linked_entity_type, d.linked_entity_ref,
         d.storage_provider, d.storage_ref, d.file_name, d.mime_type, d.size_bytes,
         d.version, d.supersedes_id, d.status, d.uploaded_by, d.created_at
  from public.tas_document d
  where d.status = 'active'
    and (p_entity_type is null or d.linked_entity_type = p_entity_type)
    and (p_entity_ref  is null or d.linked_entity_ref  = p_entity_ref)
  order by d.version desc, d.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- document_versions(id) -> the full version chain (follow supersedes_id up+down).
-- -----------------------------------------------------------------------------
create or replace function public.document_versions(p_id uuid)
returns table(
  id            uuid,
  title         text,
  version       int,
  supersedes_id uuid,
  status        text,
  file_name     text,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- A recursive CTE allows exactly ONE union between the seed and a single
  -- recursive term (Postgres 42P19). We walk the chain in BOTH directions inside
  -- that one recursive term, carrying a visited[] array as a cycle guard.
  with recursive chain as (
    -- non-recursive seed: the starting doc
    select d.id, d.supersedes_id, array[d.id] as visited
    from public.tas_document d
    where d.id = p_id
    union all
    -- single recursive term: step to a neighbor in EITHER direction, skip visited
    select d.id, d.supersedes_id, c.visited || d.id
    from public.tas_document d
    join chain c
      on (d.id = c.supersedes_id        -- older version this row supersedes
          or d.supersedes_id = c.id)    -- newer version that supersedes this row
    where d.id <> all(c.visited)        -- cycle guard
  )
  select distinct d.id, d.title, d.version, d.supersedes_id, d.status, d.file_name, d.created_at
  from public.tas_document d
  join chain c on c.id = d.id
  order by d.version desc;
$$;

-- -----------------------------------------------------------------------------
-- archive_document(id) -> soft-delete (status='archived') + audit. (admin/service)
-- -----------------------------------------------------------------------------
create or replace function public.archive_document(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_doc    public.tas_document;
begin
  select * into v_doc from public.tas_document where id = p_id;
  if v_doc is null then
    return;
  end if;

  -- Resolve caller from JWT (null when invoked with the service-role key).
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
end;
$$;

-- =============================================================================
-- EXECUTE grants
-- =============================================================================
grant execute on function public.search_audit(uuid, text, text, timestamptz, timestamptz, text, text, int, int) to authenticated;
grant execute on function public.list_documents(text, text)    to authenticated;
grant execute on function public.document_versions(uuid)       to authenticated;

-- Writer + archive stay service-role/admin until M3.1 (revoke from public).
revoke execute on function public.audit_log(uuid, text, text, text, text, jsonb) from public;
revoke execute on function public.archive_document(uuid)       from public;

-- archive_document is invoked by the documents UI; grant to authenticated (the
-- function self-resolves the caller and audits). Tightened per-role in M3.1.
grant execute on function public.archive_document(uuid)        to authenticated;

-- =============================================================================
-- End of M0.5 RPC functions.
-- =============================================================================
