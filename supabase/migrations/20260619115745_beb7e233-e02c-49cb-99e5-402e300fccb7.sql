-- =============================================================================
-- Al Hamra TAS — Module M1.5: Application Tracking (ATS Pipeline)
-- Combined apply of:
--   supabase/migrations/20260619120000_m1_5_applications.sql
--   supabase/migrations/20260619120001_m1_5_applications_rpc.sql
-- Executed EXACTLY as written in the repo.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.tas_candidate (
  id                uuid primary key default gen_random_uuid(),
  first_name        text,
  last_name         text,
  full_name_en      text,
  full_name_ar      text,
  email             citext,
  phone             text,
  nationality       text,
  nationality_class text,
  current_title     text,
  source            text,
  status            text not null default 'active' check (status in ('active','archived','blacklisted')),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
comment on table public.tas_candidate is 'Candidate entity. nationality_class captured for later Kuwaitization reporting (no quota logic here).';
create unique index if not exists uq_tas_candidate_email on public.tas_candidate(email) where email is not null;
create index if not exists idx_tas_candidate_nat_class on public.tas_candidate(nationality_class);
create index if not exists idx_tas_candidate_status     on public.tas_candidate(status);

create table if not exists public.tas_pipeline_stage (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_ar     text not null,
  sort_order  int not null default 0,
  stage_type  text not null default 'open'
                check (stage_type in ('open','interview','offer','hired','rejected','withdrawn')),
  is_terminal boolean not null default false,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_pipeline_stage is 'Configurable, ordered ATS stages. Deactivating a stage hides it from new moves; existing applications keep their stage.';
create index if not exists idx_tas_pipeline_stage_order on public.tas_pipeline_stage(sort_order);

create table if not exists public.tas_application (
  id               uuid primary key default gen_random_uuid(),
  reference        text unique,
  requisition_id   uuid not null references public.tas_requisition(id),
  candidate_id     uuid not null references public.tas_candidate(id),
  current_stage_id uuid references public.tas_pipeline_stage(id),
  status           text not null default 'active'
                     check (status in ('active','hired','rejected','withdrawn','on_hold')),
  applied_at       timestamptz not null default now(),
  source           text,
  owner_user_id    uuid references public.tas_user(id),
  rejection_reason text,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
comment on table public.tas_application is 'Candidate application to a requisition, moving through the pipeline.';
create index if not exists idx_tas_application_req    on public.tas_application(requisition_id, status);
create index if not exists idx_tas_application_cand   on public.tas_application(candidate_id);
create index if not exists idx_tas_application_stage  on public.tas_application(current_stage_id);
create index if not exists idx_tas_application_owner  on public.tas_application(owner_user_id);
create index if not exists idx_tas_application_ref    on public.tas_application(reference);
create unique index if not exists uq_tas_application_active_pair
  on public.tas_application(requisition_id, candidate_id) where status = 'active';

create table if not exists public.tas_application_stage_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tas_application(id) on delete cascade,
  from_stage_id  uuid references public.tas_pipeline_stage(id),
  to_stage_id    uuid references public.tas_pipeline_stage(id),
  moved_by       uuid references public.tas_user(id),
  note           text,
  created_at     timestamptz not null default now()
);
comment on table public.tas_application_stage_history is 'Append-only history of application stage moves.';
create index if not exists idx_tas_app_stage_hist on public.tas_application_stage_history(application_id, created_at);

drop trigger if exists trg_tas_candidate_updated_at on public.tas_candidate;
create trigger trg_tas_candidate_updated_at before update on public.tas_candidate
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_pipeline_stage_updated_at on public.tas_pipeline_stage;
create trigger trg_tas_pipeline_stage_updated_at before update on public.tas_pipeline_stage
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_application_updated_at on public.tas_application;
create trigger trg_tas_application_updated_at before update on public.tas_application
  for each row execute function public.tas_set_updated_at();

create table if not exists public.tas_application_counter (
  fiscal_year int primary key,
  last_no     int not null default 0
);
comment on table public.tas_application_counter is 'Per-year counter backing generate_application_ref() (APP-YYYY-NNNN).';

create or replace function public.generate_application_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_no   int;
begin
  insert into public.tas_application_counter (fiscal_year, last_no)
  values (v_year, 1)
  on conflict (fiscal_year)
  do update set last_no = public.tas_application_counter.last_no + 1
  returning last_no into v_no;
  return 'APP-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
end;
$$;

create or replace function public.tas_application_set_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null then
    new.reference := public.generate_application_ref();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tas_application_set_ref on public.tas_application;
create trigger trg_tas_application_set_ref before insert on public.tas_application
  for each row execute function public.tas_application_set_ref();

alter table public.tas_candidate                 enable row level security;
alter table public.tas_pipeline_stage            enable row level security;
alter table public.tas_application               enable row level security;
alter table public.tas_application_stage_history enable row level security;
alter table public.tas_application_counter       enable row level security;

drop policy if exists tas_candidate_select_auth on public.tas_candidate;
create policy tas_candidate_select_auth on public.tas_candidate
  for select to authenticated using (true);

drop policy if exists tas_pipeline_stage_select_auth on public.tas_pipeline_stage;
create policy tas_pipeline_stage_select_auth on public.tas_pipeline_stage
  for select to authenticated using (true);

drop policy if exists tas_application_select_auth on public.tas_application;
create policy tas_application_select_auth on public.tas_application
  for select to authenticated using (true);

drop policy if exists tas_app_stage_hist_select_auth on public.tas_application_stage_history;
create policy tas_app_stage_hist_select_auth on public.tas_application_stage_history
  for select to authenticated using (true);

grant select on public.tas_candidate                 to authenticated;
grant select on public.tas_pipeline_stage            to authenticated;
grant select on public.tas_application               to authenticated;
grant select on public.tas_application_stage_history to authenticated;
grant all on public.tas_candidate                 to service_role;
grant all on public.tas_pipeline_stage            to service_role;
grant all on public.tas_application               to service_role;
grant all on public.tas_application_stage_history to service_role;
grant all on public.tas_application_counter       to service_role;

insert into public.tas_pipeline_stage (code, name_en, name_ar, sort_order, stage_type, is_terminal) values
  ('applied',     'Applied',     'تم التقديم',  10,  'open',      false),
  ('screening',   'Screening',   'الفرز',       20,  'open',      false),
  ('shortlisted', 'Shortlisted', 'القائمة المختصرة', 30, 'open',  false),
  ('interview',   'Interview',   'المقابلة',    40,  'interview', false),
  ('assessment',  'Assessment',  'التقييم',     50,  'open',      false),
  ('offer',       'Offer',       'العرض',       60,  'offer',     false),
  ('hired',       'Hired',       'تم التعيين',  90,  'hired',     true),
  ('rejected',    'Rejected',    'مرفوض',       99,  'rejected',  true),
  ('withdrawn',   'Withdrawn',   'منسحب',       100, 'withdrawn', true)
on conflict (code) do nothing;

insert into public.tas_candidate (first_name, last_name, full_name_en, full_name_ar, email, nationality_class, current_title, source, status) values
  ('Sample', 'Candidate One', 'Sample Candidate One', 'مرشح تجريبي ١', 'sample.candidate1@example.com', 'kuwaiti', 'HR Officer', 'sample', 'active'),
  ('Sample', 'Candidate Two', 'Sample Candidate Two', 'مرشح تجريبي ٢', 'sample.candidate2@example.com', 'expat',   'Accountant', 'sample', 'active')
on conflict (email) where email is not null do nothing;

-- =============================================================================
-- RPC file: 20260619120001_m1_5_applications_rpc.sql
-- =============================================================================

create or replace function public.upsert_candidate(
  p_id                uuid    default null,
  p_first_name        text    default null,
  p_last_name         text    default null,
  p_full_name_en      text    default null,
  p_full_name_ar      text    default null,
  p_email             text    default null,
  p_phone             text    default null,
  p_nationality       text    default null,
  p_nationality_class text    default null,
  p_current_title     text    default null,
  p_source            text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_id     uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if p_id is null then
    insert into public.tas_candidate
      (first_name, last_name, full_name_en, full_name_ar, email, phone,
       nationality, nationality_class, current_title, source, created_by)
    values
      (p_first_name, p_last_name, p_full_name_en, p_full_name_ar, nullif(p_email,'')::citext, p_phone,
       p_nationality, p_nationality_class, p_current_title, p_source, v_caller)
    returning id into v_id;
    perform public.audit_log(v_caller, 'M1.5', 'candidate.created', 'candidate', v_id::text,
      jsonb_build_object('name', coalesce(p_full_name_en, p_full_name_ar)));
  else
    update public.tas_candidate set
      first_name = p_first_name, last_name = p_last_name,
      full_name_en = p_full_name_en, full_name_ar = p_full_name_ar,
      email = nullif(p_email,'')::citext, phone = p_phone,
      nationality = p_nationality, nationality_class = p_nationality_class,
      current_title = p_current_title, source = p_source, updated_by = v_caller
    where id = p_id;
    v_id := p_id;
    perform public.audit_log(v_caller, 'M1.5', 'candidate.updated', 'candidate', p_id::text, '{}'::jsonb);
  end if;

  return v_id;
end;
$$;

create or replace function public.create_application(
  p_requisition_id uuid,
  p_candidate_id   uuid,
  p_source         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_stage  uuid;
  v_app    uuid;
begin
  if exists (
    select 1 from public.tas_application
    where requisition_id = p_requisition_id and candidate_id = p_candidate_id and status = 'active'
  ) then
    raise exception 'duplicate_active_application'
      using message = 'An active application already exists for this candidate and requisition.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  select id into v_stage from public.tas_pipeline_stage
  where status = 'active' order by sort_order limit 1;

  insert into public.tas_application
    (requisition_id, candidate_id, current_stage_id, status, source, owner_user_id, created_by)
  values
    (p_requisition_id, p_candidate_id, v_stage, 'active', p_source, v_caller, v_caller)
  returning id into v_app;

  insert into public.tas_application_stage_history
    (application_id, from_stage_id, to_stage_id, moved_by, note)
  values (v_app, null, v_stage, v_caller, 'created');

  perform public.audit_log(v_caller, 'M1.5', 'application.created', 'application', v_app::text,
    jsonb_build_object('requisition_id', p_requisition_id, 'candidate_id', p_candidate_id));

  return v_app;
end;
$$;

create or replace function public.move_application_stage(
  p_application_id uuid,
  p_to_stage_id    uuid,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app    public.tas_application;
  v_to     public.tas_pipeline_stage;
  v_caller uuid;
begin
  select * into v_app from public.tas_application where id = p_application_id;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;

  select * into v_to from public.tas_pipeline_stage where id = p_to_stage_id;
  if v_to.id is null or v_to.status <> 'active' then
    raise exception 'target stage is invalid or inactive';
  end if;

  if v_app.current_stage_id is not distinct from p_to_stage_id then
    return;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  insert into public.tas_application_stage_history
    (application_id, from_stage_id, to_stage_id, moved_by, note)
  values (p_application_id, v_app.current_stage_id, p_to_stage_id, v_caller, p_note);

  update public.tas_application set
    current_stage_id = p_to_stage_id,
    status = case
               when v_to.stage_type = 'hired'     then 'hired'
               when v_to.stage_type = 'rejected'  then 'rejected'
               when v_to.stage_type = 'withdrawn' then 'withdrawn'
               else v_app.status
             end,
    updated_by = v_caller
  where id = p_application_id;

  perform public.audit_log(v_caller, 'M1.5', 'application.stage_moved', 'application',
    p_application_id::text, jsonb_build_object('to_stage', v_to.code, 'stage_type', v_to.stage_type));
end;
$$;

create or replace function public.set_application_status(
  p_application_id uuid,
  p_status         text,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_app    public.tas_application;
begin
  if p_status not in ('active','hired','rejected','withdrawn','on_hold') then
    raise exception 'invalid status %', p_status;
  end if;

  select * into v_app from public.tas_application where id = p_application_id;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_application set
    status = p_status,
    rejection_reason = case when p_status = 'rejected' then p_reason else rejection_reason end,
    updated_by = v_caller
  where id = p_application_id;

  perform public.audit_log(v_caller, 'M1.5', 'application.status_set', 'application',
    p_application_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.list_applications(
  p_requisition_id uuid    default null,
  p_candidate_id   uuid    default null,
  p_stage_id       uuid    default null,
  p_status         text    default null,
  p_owner_id       uuid    default null,
  p_limit          int     default 100,
  p_offset         int     default 0
)
returns table (
  id uuid, reference text, requisition_id uuid, candidate_id uuid,
  current_stage_id uuid, status text, applied_at timestamptz,
  source text, owner_user_id uuid, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.reference, a.requisition_id, a.candidate_id,
         a.current_stage_id, a.status, a.applied_at,
         a.source, a.owner_user_id, a.created_at
  from public.tas_application a
  where (p_requisition_id is null or a.requisition_id = p_requisition_id)
    and (p_candidate_id   is null or a.candidate_id   = p_candidate_id)
    and (p_stage_id       is null or a.current_stage_id = p_stage_id)
    and (p_status         is null or a.status = p_status)
    and (p_owner_id       is null or a.owner_user_id = p_owner_id)
  order by a.created_at desc
  limit greatest(coalesce(p_limit, 100), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.application_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'application', (select to_jsonb(a) from public.tas_application a where a.id = p_id),
    'candidate',   (select to_jsonb(c) from public.tas_candidate c
                      where c.id = (select candidate_id from public.tas_application where id = p_id)),
    'requisition', (select to_jsonb(r) from public.tas_requisition r
                      where r.id = (select requisition_id from public.tas_application where id = p_id)),
    'current_stage', (select to_jsonb(s) from public.tas_pipeline_stage s
                      where s.id = (select current_stage_id from public.tas_application where id = p_id)),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'from_stage_id', h.from_stage_id, 'to_stage_id', h.to_stage_id,
        'moved_by', h.moved_by, 'note', h.note, 'created_at', h.created_at
      ) order by h.created_at)
      from public.tas_application_stage_history h
      where h.application_id = p_id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.list_candidates(
  p_search text default null,
  p_limit  int  default 100,
  p_offset int  default 0
)
returns table (
  id uuid, full_name_en text, full_name_ar text, email citext,
  phone text, nationality_class text, current_title text, status text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.full_name_en, c.full_name_ar, c.email, c.phone,
         c.nationality_class, c.current_title, c.status, c.created_at
  from public.tas_candidate c
  where p_search is null
     or c.full_name_en ilike '%' || p_search || '%'
     or c.full_name_ar ilike '%' || p_search || '%'
     or (c.email)::text ilike '%' || p_search || '%'
  order by c.created_at desc
  limit greatest(coalesce(p_limit, 100), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.applications_for_candidate(p_candidate_id uuid)
returns table (
  id uuid, reference text, requisition_id uuid, current_stage_id uuid,
  status text, applied_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.reference, a.requisition_id, a.current_stage_id,
         a.status, a.applied_at, a.created_at
  from public.tas_application a
  where a.candidate_id = p_candidate_id
  order by a.created_at desc;
$$;

revoke all on function public.upsert_candidate(uuid, text, text, text, text, text, text, text, text, text, text)        from public;
revoke all on function public.create_application(uuid, uuid, text)                                                       from public;
revoke all on function public.move_application_stage(uuid, uuid, text)                                                   from public;
revoke all on function public.set_application_status(uuid, text, text)                                                   from public;
revoke all on function public.list_applications(uuid, uuid, uuid, text, uuid, int, int)                                  from public;
revoke all on function public.application_detail(uuid)                                                                   from public;
revoke all on function public.list_candidates(text, int, int)                                                            from public;
revoke all on function public.applications_for_candidate(uuid)                                                           from public;
revoke all on function public.generate_application_ref()                                                                 from public;

grant execute on function public.upsert_candidate(uuid, text, text, text, text, text, text, text, text, text, text)     to authenticated;
grant execute on function public.create_application(uuid, uuid, text)                                                    to authenticated;
grant execute on function public.move_application_stage(uuid, uuid, text)                                                to authenticated;
grant execute on function public.set_application_status(uuid, text, text)                                                to authenticated;
grant execute on function public.list_applications(uuid, uuid, uuid, text, uuid, int, int)                               to authenticated;
grant execute on function public.application_detail(uuid)                                                                to authenticated;
grant execute on function public.list_candidates(text, int, int)                                                         to authenticated;
grant execute on function public.applications_for_candidate(uuid)                                                        to authenticated;
