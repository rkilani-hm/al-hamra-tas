-- =============================================================================
-- Al Hamra TAS — Module M1.6: Screening & Shortlisting
-- =============================================================================
create extension if not exists "pgcrypto";

create table if not exists public.tas_screening_scorecard (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name_en        text not null,
  name_ar        text not null,
  description_en text,
  description_ar text,
  status         text not null default 'active' check (status in ('active','inactive')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_screening_scorecard is 'Reusable screening scorecard template (configurable).';

create table if not exists public.tas_screening_criterion (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.tas_screening_scorecard(id) on delete cascade,
  code         text not null,
  name_en      text not null,
  name_ar      text not null,
  weight       numeric not null default 1,
  max_score    int not null default 5,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (scorecard_id, code)
);
comment on table public.tas_screening_criterion is 'Bilingual scored criterion within a scorecard (weight + max_score).';
create index if not exists idx_tas_screening_criterion_card on public.tas_screening_criterion(scorecard_id, sort_order);

create table if not exists public.tas_screening (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tas_application(id) on delete cascade,
  scorecard_id   uuid references public.tas_screening_scorecard(id),
  overall_score  numeric,
  recommendation text check (recommendation in ('shortlist','reject','hold')),
  notes_en       text,
  screened_by    uuid references public.tas_user(id),
  screened_at    timestamptz not null default now(),
  status         text not null default 'draft' check (status in ('draft','submitted')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_screening is 'Screening record for an application. overall_score = weighted average of criterion scores.';
create index if not exists idx_tas_screening_application on public.tas_screening(application_id);
create index if not exists idx_tas_screening_recommendation on public.tas_screening(recommendation);
create index if not exists idx_tas_screening_screened_by on public.tas_screening(screened_by);

create table if not exists public.tas_screening_score (
  id           uuid primary key default gen_random_uuid(),
  screening_id uuid not null references public.tas_screening(id) on delete cascade,
  criterion_id uuid not null references public.tas_screening_criterion(id),
  score        numeric,
  note         text,
  unique (screening_id, criterion_id)
);
comment on table public.tas_screening_score is 'Individual criterion score within a screening.';
create index if not exists idx_tas_screening_score_screening on public.tas_screening_score(screening_id);

drop trigger if exists trg_tas_screening_scorecard_updated_at on public.tas_screening_scorecard;
create trigger trg_tas_screening_scorecard_updated_at before update on public.tas_screening_scorecard
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_screening_criterion_updated_at on public.tas_screening_criterion;
create trigger trg_tas_screening_criterion_updated_at before update on public.tas_screening_criterion
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_screening_updated_at on public.tas_screening;
create trigger trg_tas_screening_updated_at before update on public.tas_screening
  for each row execute function public.tas_set_updated_at();

alter table public.tas_screening_scorecard enable row level security;
alter table public.tas_screening_criterion enable row level security;
alter table public.tas_screening           enable row level security;
alter table public.tas_screening_score     enable row level security;

drop policy if exists tas_screening_scorecard_select_auth on public.tas_screening_scorecard;
create policy tas_screening_scorecard_select_auth on public.tas_screening_scorecard
  for select to authenticated using (true);

drop policy if exists tas_screening_criterion_select_auth on public.tas_screening_criterion;
create policy tas_screening_criterion_select_auth on public.tas_screening_criterion
  for select to authenticated using (true);

drop policy if exists tas_screening_select_auth on public.tas_screening;
create policy tas_screening_select_auth on public.tas_screening
  for select to authenticated using (true);

drop policy if exists tas_screening_score_select_auth on public.tas_screening_score;
create policy tas_screening_score_select_auth on public.tas_screening_score
  for select to authenticated using (true);

grant select on public.tas_screening_scorecard to authenticated;
grant select on public.tas_screening_criterion to authenticated;
grant select on public.tas_screening           to authenticated;
grant select on public.tas_screening_score     to authenticated;

insert into public.tas_screening_scorecard (code, name_en, name_ar, description_en, description_ar) values
  ('DEFAULT_SCREENING', 'Default Screening', 'الفرز الافتراضي',
   'Default configurable screening scorecard.', 'بطاقة فرز افتراضية قابلة للتهيئة.')
on conflict (code) do nothing;

insert into public.tas_screening_criterion (scorecard_id, code, name_en, name_ar, weight, max_score, sort_order)
select sc.id, v.code, v.name_en, v.name_ar, v.weight, 5, v.sort_order
from public.tas_screening_scorecard sc
cross join (values
  ('relevant_experience', 'Relevant Experience',   'الخبرة ذات الصلة',   2::numeric, 10),
  ('qualifications',      'Qualifications Match',   'مطابقة المؤهلات',    1::numeric, 20),
  ('communication',       'Communication',          'التواصل',            1::numeric, 30),
  ('availability',        'Availability',           'الجاهزية',           1::numeric, 40)
) as v(code, name_en, name_ar, weight, sort_order)
where sc.code = 'DEFAULT_SCREENING'
on conflict (scorecard_id, code) do nothing;

-- =============================================================================
-- M1.6 RPCs
-- =============================================================================

create or replace function public.list_screening_scorecards()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(card order by card->>'code'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', sc.id,
      'code', sc.code,
      'name_en', sc.name_en,
      'name_ar', sc.name_ar,
      'description_en', sc.description_en,
      'description_ar', sc.description_ar,
      'status', sc.status,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cr.id,
          'code', cr.code,
          'name_en', cr.name_en,
          'name_ar', cr.name_ar,
          'weight', cr.weight,
          'max_score', cr.max_score,
          'sort_order', cr.sort_order
        ) order by cr.sort_order, cr.code)
        from public.tas_screening_criterion cr
        where cr.scorecard_id = sc.id
      ), '[]'::jsonb)
    ) as card
    from public.tas_screening_scorecard sc
    where sc.status = 'active'
  ) cards;
$$;

create or replace function public.create_screening(
  p_application_id uuid,
  p_scorecard_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_card   uuid;
  v_id     uuid;
begin
  if not exists (select 1 from public.tas_application where id = p_application_id) then
    raise exception 'application % not found', p_application_id;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  select id into v_id from public.tas_screening
  where application_id = p_application_id and status = 'draft'
  order by created_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;

  v_card := p_scorecard_id;
  if v_card is null then
    select id into v_card from public.tas_screening_scorecard
    where status = 'active' and code = 'DEFAULT_SCREENING' limit 1;
  end if;
  if v_card is null then
    select id into v_card from public.tas_screening_scorecard
    where status = 'active' order by code limit 1;
  end if;

  insert into public.tas_screening
    (application_id, scorecard_id, status, screened_by, created_by)
  values
    (p_application_id, v_card, 'draft', v_caller, v_caller)
  returning id into v_id;

  perform public.audit_log(v_caller, 'M1.6', 'screening.created', 'screening', v_id::text,
    jsonb_build_object('application_id', p_application_id, 'scorecard_id', v_card));

  return v_id;
end;
$$;

create or replace function public.save_screening_scores(
  p_screening_id uuid,
  p_scores       jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_overall numeric;
begin
  if not exists (select 1 from public.tas_screening where id = p_screening_id) then
    raise exception 'screening % not found', p_screening_id;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  insert into public.tas_screening_score (screening_id, criterion_id, score, note)
  select p_screening_id,
         (elem->>'criterion_id')::uuid,
         nullif(elem->>'score','')::numeric,
         nullif(elem->>'note','')
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as elem
  where (elem->>'criterion_id') is not null
  on conflict (screening_id, criterion_id) do update
    set score = excluded.score,
        note  = excluded.note;

  select case when sum(cr.weight) > 0
              then round(sum(ss.score * cr.weight) / sum(cr.weight), 2)
              else null end
    into v_overall
  from public.tas_screening_score ss
  join public.tas_screening_criterion cr on cr.id = ss.criterion_id
  where ss.screening_id = p_screening_id and ss.score is not null;

  update public.tas_screening
    set overall_score = v_overall, updated_by = v_caller
  where id = p_screening_id;

  return v_overall;
end;
$$;

create or replace function public.submit_screening(
  p_screening_id   uuid,
  p_recommendation text,
  p_notes_en       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_scr     public.tas_screening;
  v_stage   uuid;
  v_moved   boolean := false;
  v_message text := '';
begin
  if p_recommendation not in ('shortlist','reject','hold') then
    raise exception 'invalid recommendation %', p_recommendation;
  end if;

  select * into v_scr from public.tas_screening where id = p_screening_id;
  if v_scr.id is null then raise exception 'screening % not found', p_screening_id; end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_screening set
    recommendation = p_recommendation,
    notes_en       = p_notes_en,
    status         = 'submitted',
    screened_by    = coalesce(v_scr.screened_by, v_caller),
    screened_at    = now(),
    updated_by     = v_caller
  where id = p_screening_id;

  if p_recommendation = 'shortlist' then
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and code = 'shortlisted' limit 1;
    if v_stage is null then
      select id into v_stage from public.tas_pipeline_stage
      where status = 'active' and stage_type = 'shortlisted' order by sort_order limit 1;
    end if;
    if v_stage is not null then
      perform public.move_application_stage(v_scr.application_id, v_stage, 'Screening: shortlisted');
      v_moved := true;
    else
      v_message := 'no_shortlist_stage';
    end if;

  elsif p_recommendation = 'reject' then
    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and stage_type = 'rejected' order by sort_order limit 1;
    if v_stage is not null then
      perform public.move_application_stage(v_scr.application_id, v_stage, 'Screening: rejected');
      v_moved := true;
    else
      perform public.set_application_status(v_scr.application_id, 'rejected', 'Screening: rejected');
      v_moved := true;
      v_message := 'rejected_via_status';
    end if;
  end if;

  perform public.audit_log(v_caller, 'M1.6', 'screening.submitted', 'screening', p_screening_id::text,
    jsonb_build_object('recommendation', p_recommendation, 'application_id', v_scr.application_id,
                       'moved', v_moved, 'message', v_message));

  return jsonb_build_object(
    'screening_id', p_screening_id,
    'recommendation', p_recommendation,
    'application_id', v_scr.application_id,
    'moved', v_moved,
    'message', v_message
  );
end;
$$;

create or replace function public.screening_detail(p_application_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(rec order by rec->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', s.id,
      'application_id', s.application_id,
      'scorecard_id', s.scorecard_id,
      'scorecard_name_en', sc.name_en,
      'scorecard_name_ar', sc.name_ar,
      'overall_score', s.overall_score,
      'recommendation', s.recommendation,
      'notes_en', s.notes_en,
      'status', s.status,
      'screened_by', s.screened_by,
      'screened_by_name_en', su.display_name_en,
      'screened_by_name_ar', su.display_name_ar,
      'screened_at', s.screened_at,
      'created_at', s.created_at,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'criterion_id', cr.id,
          'code', cr.code,
          'name_en', cr.name_en,
          'name_ar', cr.name_ar,
          'weight', cr.weight,
          'max_score', cr.max_score,
          'sort_order', cr.sort_order,
          'score', ss.score,
          'note', ss.note
        ) order by cr.sort_order, cr.code)
        from public.tas_screening_criterion cr
        left join public.tas_screening_score ss
          on ss.criterion_id = cr.id and ss.screening_id = s.id
        where cr.scorecard_id = s.scorecard_id
      ), '[]'::jsonb)
    ) as rec
    from public.tas_screening s
    left join public.tas_screening_scorecard sc on sc.id = s.scorecard_id
    left join public.tas_user su on su.id = s.screened_by
    where s.application_id = p_application_id
  ) recs;
$$;

grant execute on function public.list_screening_scorecards()                      to authenticated;
grant execute on function public.create_screening(uuid, uuid)                     to authenticated;
grant execute on function public.save_screening_scores(uuid, jsonb)               to authenticated;
grant execute on function public.submit_screening(uuid, text, text)               to authenticated;
grant execute on function public.screening_detail(uuid)                           to authenticated;
