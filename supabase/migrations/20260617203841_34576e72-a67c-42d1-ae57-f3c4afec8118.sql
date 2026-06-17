-- =============================================================================
-- Al Hamra TAS — Module M0.2: Core Configuration
-- =============================================================================
create extension if not exists "pgcrypto";

alter table public.tas_entity
  add column if not exists commercial_reg_no       text,
  add column if not exists kuwaitization_target_pct numeric;
comment on column public.tas_entity.commercial_reg_no is 'Kuwait commercial registration (CR) number.';
comment on column public.tas_entity.kuwaitization_target_pct is 'Target Kuwaiti-national workforce % (Kuwaitization quota).';

alter table public.tas_branch
  add column if not exists address_en text,
  add column if not exists address_ar text,
  add column if not exists paci_area  text;
comment on column public.tas_branch.paci_area is 'PACI (Kuwait) area / block reference.';

alter table public.tas_department
  add column if not exists parent_department_id uuid,
  add column if not exists function_code        text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tas_department_parent_department_id_fkey'
  ) then
    alter table public.tas_department
      add constraint tas_department_parent_department_id_fkey
      foreign key (parent_department_id) references public.tas_department(id) on delete set null;
  end if;
end $$;
comment on column public.tas_department.parent_department_id is 'Self-reference for sub-departments / sections.';

create index if not exists idx_tas_department_parent on public.tas_department(parent_department_id);

create table if not exists public.tas_job_family (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_ar     text not null,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_job_family is 'Job family / job function grouping.';

create table if not exists public.tas_job_grade (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_ar     text not null,
  rank        int,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.tas_job_grade is 'Job grade / level. rank orders grades (1 = lowest).';

create table if not exists public.tas_job_position (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  name_en                  text not null,
  name_ar                  text not null,
  job_family_id            uuid references public.tas_job_family(id) on delete set null,
  job_grade_id             uuid references public.tas_job_grade(id) on delete set null,
  status                   text not null default 'active',
  is_kuwaitization_targeted boolean not null default false,
  created_at               timestamptz not null default now(),
  created_by               uuid,
  updated_at               timestamptz not null default now(),
  updated_by               uuid
);
comment on table public.tas_job_position is 'Job/position definition, linked to a family and grade.';
comment on column public.tas_job_position.is_kuwaitization_targeted is 'Flagged for Kuwaitization quota tracking.';

create table if not exists public.tas_jd_template (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  job_position_id  uuid references public.tas_job_position(id) on delete set null,
  title_en         text not null,
  title_ar         text not null,
  summary_en       text,
  summary_ar       text,
  status           text not null default 'draft'
                     check (status in ('draft','active','archived')),
  version          int not null default 1,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
comment on table public.tas_jd_template is 'Reusable bilingual job-description template (optionally tied to a position).';

create table if not exists public.tas_jd_section (
  id             uuid primary key default gen_random_uuid(),
  jd_template_id uuid not null references public.tas_jd_template(id) on delete cascade,
  section_type   text not null
                   check (section_type in ('responsibilities','requirements',
                                           'qualifications','benefits','other')),
  heading_en     text,
  heading_ar     text,
  body_en        text,
  body_ar        text,
  sort_order     int not null default 0
);
comment on table public.tas_jd_section is 'Ordered bilingual sections within a JD template.';

create table if not exists public.tas_competency (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name_en         text not null,
  name_ar         text not null,
  category        text,
  description_en  text,
  description_ar  text,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
comment on table public.tas_competency is 'Reusable bilingual competency definitions.';

create table if not exists public.tas_jd_competency (
  jd_template_id     uuid not null references public.tas_jd_template(id) on delete cascade,
  competency_id      uuid not null references public.tas_competency(id) on delete cascade,
  proficiency_level  int,
  primary key (jd_template_id, competency_id)
);
comment on table public.tas_jd_competency is 'Competencies attached to a JD template, with target proficiency.';

create table if not exists public.tas_lookup (
  id          uuid primary key default gen_random_uuid(),
  lookup_type text not null,
  code        text not null,
  name_en     text not null,
  name_ar     text not null,
  sort_order  int not null default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (lookup_type, code)
);
comment on table public.tas_lookup is 'Generic bilingual reference lookups keyed by (lookup_type, code).';

create index if not exists idx_tas_job_family_code      on public.tas_job_family(code);
create index if not exists idx_tas_job_grade_code        on public.tas_job_grade(code);
create index if not exists idx_tas_job_position_code     on public.tas_job_position(code);
create index if not exists idx_tas_job_position_family   on public.tas_job_position(job_family_id);
create index if not exists idx_tas_job_position_grade    on public.tas_job_position(job_grade_id);
create index if not exists idx_tas_jd_template_code      on public.tas_jd_template(code);
create index if not exists idx_tas_jd_template_position  on public.tas_jd_template(job_position_id);
create index if not exists idx_tas_jd_section_template   on public.tas_jd_section(jd_template_id);
create index if not exists idx_tas_competency_code       on public.tas_competency(code);
create index if not exists idx_tas_jd_competency_comp    on public.tas_jd_competency(competency_id);
create index if not exists idx_tas_lookup_type           on public.tas_lookup(lookup_type);

drop trigger if exists trg_tas_job_family_updated_at   on public.tas_job_family;
create trigger trg_tas_job_family_updated_at   before update on public.tas_job_family
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_job_grade_updated_at    on public.tas_job_grade;
create trigger trg_tas_job_grade_updated_at    before update on public.tas_job_grade
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_job_position_updated_at on public.tas_job_position;
create trigger trg_tas_job_position_updated_at before update on public.tas_job_position
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_jd_template_updated_at  on public.tas_jd_template;
create trigger trg_tas_jd_template_updated_at  before update on public.tas_jd_template
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_competency_updated_at   on public.tas_competency;
create trigger trg_tas_competency_updated_at   before update on public.tas_competency
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_lookup_updated_at       on public.tas_lookup;
create trigger trg_tas_lookup_updated_at       before update on public.tas_lookup
  for each row execute function public.tas_set_updated_at();

alter table public.tas_job_family   enable row level security;
alter table public.tas_job_grade    enable row level security;
alter table public.tas_job_position enable row level security;
alter table public.tas_jd_template  enable row level security;
alter table public.tas_jd_section   enable row level security;
alter table public.tas_competency   enable row level security;
alter table public.tas_jd_competency enable row level security;
alter table public.tas_lookup       enable row level security;

insert into public.tas_lookup (lookup_type, code, name_en, name_ar, sort_order) values
  ('employment_type', 'full_time',  'Full-time', 'دوام كامل',  1),
  ('employment_type', 'part_time',  'Part-time', 'دوام جزئي',  2),
  ('employment_type', 'contract',   'Contract',  'عقد',        3),
  ('employment_type', 'temporary',  'Temporary', 'مؤقت',       4),
  ('contract_type',   'limited',    'Limited',   'محدد المدة',   1),
  ('contract_type',   'unlimited',  'Unlimited', 'غير محدد المدة', 2),
  ('nationality_class', 'kuwaiti', 'Kuwaiti', 'كويتي',          1),
  ('nationality_class', 'gcc',     'GCC',     'دول الخليج',      2),
  ('nationality_class', 'expat',   'Expat',   'وافد',           3),
  ('work_location_type', 'on_site', 'On-site', 'في الموقع',    1),
  ('work_location_type', 'hybrid',  'Hybrid',  'هجين',          2),
  ('work_location_type', 'remote',  'Remote',  'عن بُعد',       3)
on conflict (lookup_type, code) do nothing;

insert into public.tas_job_family (code, name_en, name_ar) values
  ('FAM_ADMIN', 'Administration', 'الإدارة'),
  ('FAM_FIN',   'Finance',        'المالية'),
  ('FAM_ENG',   'Engineering',    'الهندسة')
on conflict (code) do nothing;

insert into public.tas_job_grade (code, name_en, name_ar, rank) values
  ('G1', 'Grade 1 — Entry',      'الدرجة 1 — مبتدئ',  1),
  ('G2', 'Grade 2 — Junior',     'الدرجة 2 — مبتدئ أول', 2),
  ('G3', 'Grade 3 — Senior',     'الدرجة 3 — أول',     3),
  ('G4', 'Grade 4 — Lead',       'الدرجة 4 — قائد',    4)
on conflict (code) do nothing;

insert into public.tas_job_position (code, name_en, name_ar, job_family_id, job_grade_id, is_kuwaitization_targeted)
select v.code, v.name_en, v.name_ar, f.id, g.id, v.kt
from (values
  ('POS_HR_OFFICER', 'HR Officer',           'موظف موارد بشرية', 'FAM_ADMIN', 'G2', true),
  ('POS_ACCOUNTANT', 'Accountant',           'محاسب',            'FAM_FIN',   'G3', true),
  ('POS_CIVIL_ENG',  'Civil Engineer',       'مهندس مدني',       'FAM_ENG',   'G3', false)
) as v(code, name_en, name_ar, fam_code, grade_code, kt)
left join public.tas_job_family f on f.code = v.fam_code
left join public.tas_job_grade  g on g.code = v.grade_code
on conflict (code) do nothing;

insert into public.tas_jd_template (code, job_position_id, title_en, title_ar, summary_en, summary_ar, status, version)
select 'JD_HR_OFFICER', p.id,
       'HR Officer', 'موظف موارد بشرية',
       'Sample job description template — edit or delete in Core Configuration.',
       'نموذج وصف وظيفي تجريبي — يمكن تعديله أو حذفه في الإعدادات الأساسية.',
       'active', 1
from public.tas_job_position p
where p.code = 'POS_HR_OFFICER'
on conflict (code) do nothing;

insert into public.tas_jd_section (jd_template_id, section_type, heading_en, heading_ar, body_en, body_ar, sort_order)
select t.id, s.section_type, s.heading_en, s.heading_ar, s.body_en, s.body_ar, s.sort_order
from public.tas_jd_template t
cross join (values
  ('responsibilities', 'Responsibilities', 'المسؤوليات',
     'Support recruitment, onboarding, and employee records.',
     'دعم التوظيف والإلحاق وسجلات الموظفين.', 1),
  ('requirements', 'Requirements', 'المتطلبات',
     '2+ years of HR experience; knowledge of Kuwait Labour Law No. 6 of 2010.',
     'خبرة سنتين فأكثر في الموارد البشرية؛ معرفة بقانون العمل الكويتي رقم 6 لسنة 2010.', 2),
  ('qualifications', 'Qualifications', 'المؤهلات',
     'Bachelor''s degree in HR, Business, or related field.',
     'درجة البكالوريوس في الموارد البشرية أو الأعمال أو مجال ذي صلة.', 3)
) as s(section_type, heading_en, heading_ar, body_en, body_ar, sort_order)
where t.code = 'JD_HR_OFFICER'
on conflict do nothing;

insert into public.tas_competency (code, name_en, name_ar, category, description_en, description_ar) values
  ('COMP_COMM', 'Communication', 'التواصل', 'core',
     'Communicates clearly in Arabic and English.', 'يتواصل بوضوح بالعربية والإنجليزية.'),
  ('COMP_LABOR_LAW', 'Kuwait Labour Law', 'قانون العمل الكويتي', 'technical',
     'Applies Kuwait Labour Law No. 6 of 2010 correctly.', 'يطبّق قانون العمل الكويتي رقم 6 لسنة 2010 بشكل صحيح.')
on conflict (code) do nothing;

insert into public.tas_jd_competency (jd_template_id, competency_id, proficiency_level)
select t.id, c.id, lvl.proficiency_level
from public.tas_jd_template t
join (values ('COMP_COMM', 3), ('COMP_LABOR_LAW', 4)) as lvl(code, proficiency_level)
  on true
join public.tas_competency c on c.code = lvl.code
where t.code = 'JD_HR_OFFICER'
on conflict (jd_template_id, competency_id) do nothing;

-- =============================================================================
-- Authenticated READ RLS for config tables (M0.2 follow-up)
-- =============================================================================

drop policy if exists tas_entity_select_authenticated on public.tas_entity;
create policy tas_entity_select_authenticated on public.tas_entity
  for select to authenticated using (true);

drop policy if exists tas_branch_select_authenticated on public.tas_branch;
create policy tas_branch_select_authenticated on public.tas_branch
  for select to authenticated using (true);

drop policy if exists tas_department_select_authenticated on public.tas_department;
create policy tas_department_select_authenticated on public.tas_department
  for select to authenticated using (true);

drop policy if exists tas_job_family_select_authenticated on public.tas_job_family;
create policy tas_job_family_select_authenticated on public.tas_job_family
  for select to authenticated using (true);

drop policy if exists tas_job_grade_select_authenticated on public.tas_job_grade;
create policy tas_job_grade_select_authenticated on public.tas_job_grade
  for select to authenticated using (true);

drop policy if exists tas_job_position_select_authenticated on public.tas_job_position;
create policy tas_job_position_select_authenticated on public.tas_job_position
  for select to authenticated using (true);

drop policy if exists tas_jd_template_select_authenticated on public.tas_jd_template;
create policy tas_jd_template_select_authenticated on public.tas_jd_template
  for select to authenticated using (true);

drop policy if exists tas_jd_section_select_authenticated on public.tas_jd_section;
create policy tas_jd_section_select_authenticated on public.tas_jd_section
  for select to authenticated using (true);

drop policy if exists tas_competency_select_authenticated on public.tas_competency;
create policy tas_competency_select_authenticated on public.tas_competency
  for select to authenticated using (true);

drop policy if exists tas_jd_competency_select_authenticated on public.tas_jd_competency;
create policy tas_jd_competency_select_authenticated on public.tas_jd_competency
  for select to authenticated using (true);

drop policy if exists tas_lookup_select_authenticated on public.tas_lookup;
create policy tas_lookup_select_authenticated on public.tas_lookup
  for select to authenticated using (true);
