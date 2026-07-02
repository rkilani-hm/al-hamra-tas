-- =============================================================================
-- Al Hamra TAS — Module M3.3: Audit & Compliance Reporting
-- =============================================================================
-- System-wide reporting over the M0.5 audit store (tas_audit_log). Gated on the
-- existing audit.view key (no new key/table). No storage bucket SQL. No recursive
-- CTEs.
-- =============================================================================

create or replace function public.audit_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._has_permission('audit.view') then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.tas_audit_log),
    'last_24h', (select count(*) from public.tas_audit_log where created_at >= now() - interval '24 hours'),
    'by_module', coalesce((
      select jsonb_agg(jsonb_build_object('module_code', coalesce(module_code,'—'), 'count', c) order by c desc)
      from (select module_code, count(*) as c from public.tas_audit_log group by module_code) m
    ), '[]'::jsonb),
    'by_event', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', coalesce(event_type,'—'), 'count', c) order by c desc)
      from (select event_type, count(*) as c from public.tas_audit_log group by event_type limit 20) e
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.audit_report(p_module text default null, p_limit int default 100, p_offset int default 0)
returns table(
  id uuid, created_at timestamptz, actor_name text, module_code text,
  event_type text, entity_type text, entity_ref text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._has_permission('audit.view') then raise exception 'not_authorized'; end if;
  return query
  select l.id, l.created_at,
         coalesce(u.display_name_en, u.email::text, '—') as actor_name,
         l.module_code, l.event_type, l.entity_type, l.entity_ref
  from public.tas_audit_log l
  left join public.tas_user u on u.id = l.actor_user_id
  where (p_module is null or l.module_code = p_module)
  order by l.created_at desc
  limit greatest(coalesce(p_limit, 100), 0) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

grant execute on function public.audit_stats()                    to authenticated;
grant execute on function public.audit_report(text, int, int)     to authenticated;

-- =============================================================================
-- End of M3.3 — Audit & Compliance Reporting.
-- =============================================================================
