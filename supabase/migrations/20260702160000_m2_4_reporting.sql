-- =============================================================================
-- Al Hamra TAS — Module M2.4: Reporting & Analytics (native KPIs)
-- =============================================================================
-- Native recruitment KPI aggregation from existing tables. Gated on the existing
-- report.view key (no new key, no new table). No storage bucket SQL. No recursive
-- CTEs.
-- =============================================================================

create or replace function public.recruitment_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public._has_permission('report.view') then raise exception 'not_authorized'; end if;

  select jsonb_build_object(
    'open_requisitions', (select count(*) from public.tas_requisition where status = 'published'),
    'active_applications', (select count(*) from public.tas_application where status = 'active'),
    'offers_pending', (select count(*) from public.tas_offer where status in ('in_approval','issued')),
    'hires', (select count(*) from public.tas_application where status = 'hired'),
    'by_stage', coalesce((
      select jsonb_agg(x order by x->>'name_en') from (
        select jsonb_build_object('stage_id', s.id, 'name_en', s.name_en, 'name_ar', s.name_ar,
                                  'count', count(a.*)) as x
        from public.tas_pipeline_stage s
        left join public.tas_application a on a.current_stage_id = s.id and a.status = 'active'
        where s.status = 'active'
        group by s.id, s.name_en, s.name_ar, s.sort_order
        order by s.sort_order
      ) t
    ), '[]'::jsonb),
    'offers_by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', c))
      from (select status, count(*) as c from public.tas_offer group by status) o
    ), '[]'::jsonb),
    'applications_by_source', coalesce((
      select jsonb_agg(jsonb_build_object('source', coalesce(source,'unknown'), 'count', c))
      from (select source, count(*) as c from public.tas_application group by source) s
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.recruitment_kpis() to authenticated;

-- =============================================================================
-- End of M2.4 — Reporting & Analytics.
-- =============================================================================
