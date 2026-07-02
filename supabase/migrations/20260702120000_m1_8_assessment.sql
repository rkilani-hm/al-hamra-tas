-- =============================================================================
-- Al Hamra TAS — Module M1.8: Assessment & Evaluation
-- =============================================================================
-- Structured candidate assessment between interview (M1.7) and offer (M1.9):
-- typed assessment per application, weighted scored items, overall + recommendation.
-- RBAC via new key assessment.write. Reads open; writes via SECURITY DEFINER RPCs.
-- No storage bucket SQL. No recursive CTEs.
-- =============================================================================

create table if not exists public.tas_assessment (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.tas_application(id),
  candidate_id    uuid references public.tas_candidate(id),
  assessment_type text not null default 'other' check (assessment_type in ('technical','psychometric','case_study','other')),
  title           text,
  status          text not null default 'draft' check (status in ('draft','submitted')),
  overall_score   numeric,
  recommendation  text check (recommendation in ('proceed','hold','reject')),
  notes           text,
  assessed_by     uuid references public.tas_user(id),
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
comment on table public.tas_assessment is 'Candidate assessment header per application (M1.8).';
create index if not exists idx_tas_assessment_app on public.tas_assessment(application_id, status);

create table if not exists public.tas_assessment_item (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.tas_assessment(id) on delete cascade,
  label_en      text,
  label_ar      text,
  weight        numeric not null default 1,
  score         numeric,
  max_score     numeric not null default 5,
  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.tas_assessment_item is 'Weighted scored criteria for an assessment (M1.8).';
create index if not exists idx_tas_assessment_item_a on public.tas_assessment_item(assessment_id);

drop trigger if exists trg_tas_assessment_updated_at on public.tas_assessment;
create trigger trg_tas_assessment_updated_at before update on public.tas_assessment
  for each row execute function public.tas_set_updated_at();
drop trigger if exists trg_tas_assessment_item_updated_at on public.tas_assessment_item;
create trigger trg_tas_assessment_item_updated_at before update on public.tas_assessment_item
  for each row execute function public.tas_set_updated_at();

alter table public.tas_assessment      enable row level security;
alter table public.tas_assessment_item enable row level security;
drop policy if exists tas_assessment_sel on public.tas_assessment;
create policy tas_assessment_sel on public.tas_assessment for select to authenticated using (true);
drop policy if exists tas_assessment_item_sel on public.tas_assessment_item;
create policy tas_assessment_item_sel on public.tas_assessment_item for select to authenticated using (true);
grant select on public.tas_assessment      to authenticated;
grant select on public.tas_assessment_item to authenticated;

insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('assessment.write', 'assessment', 'Write Assessments', 'كتابة التقييمات', false)
on conflict (key) where key is not null do nothing;
insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('RECRUITER'),('INTERVIEWER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'assessment.write'
on conflict (role_id, permission_id) do nothing;

-- create_assessment — draft + default items.
create or replace function public.create_assessment(p_application_id uuid, p_type text default 'other', p_title text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_a uuid; v_cand uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('assessment.write') then raise exception 'not_authorized'; end if;
  if coalesce(p_type,'other') not in ('technical','psychometric','case_study','other') then raise exception 'invalid type %', p_type; end if;

  select candidate_id into v_cand from public.tas_application where id = p_application_id;
  if not found then raise exception 'application % not found', p_application_id; end if;

  insert into public.tas_assessment (application_id, candidate_id, assessment_type, title, assessed_by, created_by)
  values (p_application_id, v_cand, coalesce(p_type,'other'), p_title, v_caller, v_caller)
  returning id into v_a;

  insert into public.tas_assessment_item (assessment_id, label_en, label_ar, weight, max_score, created_by) values
    (v_a, 'Technical / Domain', 'المهارات التقنية / التخصص', 2, 5, v_caller),
    (v_a, 'Communication',      'التواصل',                   1, 5, v_caller),
    (v_a, 'Problem Solving',    'حل المشكلات',               1, 5, v_caller);

  perform public.audit_log(v_caller, 'M1.8', 'assessment.created', 'assessment', v_a::text,
    jsonb_build_object('application_id', p_application_id, 'type', p_type));
  return v_a;
end; $$;

-- save_assessment_items — upsert item scores; recompute weighted overall.
create or replace function public.save_assessment_items(p_assessment_id uuid, p_items jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_overall numeric;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('assessment.write') then raise exception 'not_authorized'; end if;

  update public.tas_assessment_item i
    set score = nullif(e.elem->>'score','')::numeric,
        note  = nullif(e.elem->>'note',''),
        updated_by = v_caller
  from (select elem from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as elem) e
  where i.id = (e.elem->>'id')::uuid and i.assessment_id = p_assessment_id;

  select case when sum(weight) filter (where score is not null) > 0
              then round(sum(score * weight) filter (where score is not null) / sum(weight) filter (where score is not null), 2)
              else null end
    into v_overall
  from public.tas_assessment_item where assessment_id = p_assessment_id;

  update public.tas_assessment set overall_score = v_overall, updated_by = v_caller where id = p_assessment_id;
  return v_overall;
end; $$;

-- submit_assessment — finalize with recommendation.
create or replace function public.submit_assessment(p_assessment_id uuid, p_recommendation text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  if p_recommendation not in ('proceed','hold','reject') then raise exception 'invalid recommendation %', p_recommendation; end if;
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('assessment.write') then raise exception 'not_authorized'; end if;

  update public.tas_assessment
    set status = 'submitted', recommendation = p_recommendation, notes = p_notes,
        submitted_at = now(), updated_by = v_caller
  where id = p_assessment_id;
  if not found then raise exception 'assessment % not found', p_assessment_id; end if;

  perform public.audit_log(v_caller, 'M1.8', 'assessment.submitted', 'assessment', p_assessment_id::text,
    jsonb_build_object('recommendation', p_recommendation));
end; $$;

create or replace function public.assessment_detail(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'assessment', (select to_jsonb(a) from public.tas_assessment a where a.id = p_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'label_en', i.label_en, 'label_ar', i.label_ar, 'weight', i.weight,
        'score', i.score, 'max_score', i.max_score, 'note', i.note) order by i.created_at)
      from public.tas_assessment_item i where i.assessment_id = p_id), '[]'::jsonb)
  );
$$;

create or replace function public.list_assessments(p_application_id uuid default null, p_limit int default 50, p_offset int default 0)
returns table(id uuid, application_id uuid, assessment_type text, title text, status text, overall_score numeric, recommendation text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.application_id, a.assessment_type, a.title, a.status, a.overall_score, a.recommendation, a.created_at
  from public.tas_assessment a
  where (p_application_id is null or a.application_id = p_application_id)
  order by a.created_at desc
  limit greatest(coalesce(p_limit, 50), 0) offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.create_assessment(uuid, text, text)          to authenticated;
grant execute on function public.save_assessment_items(uuid, jsonb)           to authenticated;
grant execute on function public.submit_assessment(uuid, text, text)          to authenticated;
grant execute on function public.assessment_detail(uuid)                      to authenticated;
grant execute on function public.list_assessments(uuid, int, int)             to authenticated;

-- =============================================================================
-- End of M1.8 — Assessment & Evaluation.
-- =============================================================================
