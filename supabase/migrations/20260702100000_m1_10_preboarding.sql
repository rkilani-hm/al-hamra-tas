-- =============================================================================
-- Al Hamra TAS — Module M1.10: Pre-Boarding & Document Collection
-- =============================================================================
-- After an offer is accepted (M1.9 onboarding_ready), collect the new hire's
-- mandatory documents against a checklist and gate a "pre-boarding complete"
-- milestone that feeds M1.11. Reuses the M0.5 tas_document store + DocumentPanel.
-- RBAC via new key preboarding.manage (SYSTEM_ADMIN bypasses _has_permission).
-- Reads stay open (authenticated); writes go through SECURITY DEFINER RPCs.
-- No storage bucket SQL. No recursive CTEs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.tas_preboarding (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.tas_application(id),
  candidate_id   uuid references public.tas_candidate(id),
  offer_id       uuid references public.tas_offer(id),
  status         text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  completed_by   uuid references public.tas_user(id),
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_preboarding is 'One pre-boarding record per accepted-offer application (M1.10).';

create index if not exists idx_tas_preboarding_status    on public.tas_preboarding(status);
create index if not exists idx_tas_preboarding_candidate on public.tas_preboarding(candidate_id);

create table if not exists public.tas_preboarding_item (
  id             uuid primary key default gen_random_uuid(),
  preboarding_id uuid not null references public.tas_preboarding(id) on delete cascade,
  doc_category   text not null check (doc_category in ('civil_id','passport','visa_residency','certificate','other')),
  label_en       text,
  label_ar       text,
  required       boolean not null default true,
  status         text not null default 'pending' check (status in ('pending','collected','verified','waived')),
  document_id    uuid references public.tas_document(id),
  waived_reason  text,
  collected_at   timestamptz,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_preboarding_item is 'Pre-boarding checklist rows; one document slot per required category (M1.10).';

create index if not exists idx_tas_preboarding_item_pb on public.tas_preboarding_item(preboarding_id, status);
-- One row per named category per pre-boarding; multiple 'other' allowed (partial predicate; rubric 12).
create unique index if not exists uq_tas_preboarding_item_cat
  on public.tas_preboarding_item(preboarding_id, doc_category)
  where doc_category <> 'other';

-- -----------------------------------------------------------------------------
-- 2. updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists trg_tas_preboarding_updated_at on public.tas_preboarding;
create trigger trg_tas_preboarding_updated_at before update on public.tas_preboarding
  for each row execute function public.tas_set_updated_at();

drop trigger if exists trg_tas_preboarding_item_updated_at on public.tas_preboarding_item;
create trigger trg_tas_preboarding_item_updated_at before update on public.tas_preboarding_item
  for each row execute function public.tas_set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. RLS (authenticated SELECT; writes via SECURITY DEFINER RPCs only)
-- -----------------------------------------------------------------------------
alter table public.tas_preboarding      enable row level security;
alter table public.tas_preboarding_item enable row level security;

drop policy if exists tas_preboarding_sel on public.tas_preboarding;
create policy tas_preboarding_sel on public.tas_preboarding
  for select to authenticated using (true);

drop policy if exists tas_preboarding_item_sel on public.tas_preboarding_item;
create policy tas_preboarding_item_sel on public.tas_preboarding_item
  for select to authenticated using (true);

grant select on public.tas_preboarding      to authenticated;
grant select on public.tas_preboarding_item to authenticated;

-- -----------------------------------------------------------------------------
-- 4. NEW KEY — preboarding.manage + grants
-- -----------------------------------------------------------------------------
insert into public.tas_permission (key, area, name_en, name_ar, is_system) values
  ('preboarding.manage', 'preboarding', 'Manage Pre-Boarding', 'إدارة ما قبل الالتحاق', false)
on conflict (key) where key is not null do nothing;

insert into public.tas_role_permission (role_id, permission_id)
select r.id, p.id
from public.tas_role r
join (values ('SYSTEM_ADMIN'),('HR_MANAGER'),('RECRUITER')) as g(role_code) on g.role_code = r.code
join public.tas_permission p on p.key = 'preboarding.manage'
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------

-- start_preboarding — idempotent; seeds the default checklist.
create or replace function public.start_preboarding(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_pb     uuid;
  v_cand   uuid;
  v_offer  uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('preboarding.manage') then raise exception 'not_authorized'; end if;

  select id into v_pb from public.tas_preboarding where application_id = p_application_id;
  if v_pb is not null then return v_pb; end if;

  select candidate_id into v_cand from public.tas_application where id = p_application_id;
  if not found then raise exception 'application % not found', p_application_id; end if;

  select id into v_offer from public.tas_offer
  where application_id = p_application_id and status = 'accepted'
  order by accepted_at desc nulls last limit 1;

  insert into public.tas_preboarding (application_id, candidate_id, offer_id, created_by)
  values (p_application_id, v_cand, v_offer, v_caller)
  returning id into v_pb;

  insert into public.tas_preboarding_item (preboarding_id, doc_category, label_en, label_ar, required, created_by)
  values
    (v_pb, 'civil_id',       'Civil ID',            'البطاقة المدنية',   true,  v_caller),
    (v_pb, 'passport',       'Passport',            'جواز السفر',        true,  v_caller),
    (v_pb, 'visa_residency', 'Visa / Residency',    'التأشيرة / الإقامة', true,  v_caller),
    (v_pb, 'certificate',    'Certificates',        'الشهادات',          false, v_caller);

  perform public.audit_log(v_caller, 'M1.10', 'preboarding.started', 'preboarding', v_pb::text,
    jsonb_build_object('application_id', p_application_id));

  return v_pb;
end;
$$;

-- set_preboarding_item — mark collected/verified/waived; link a document.
create or replace function public.set_preboarding_item(
  p_item_id     uuid,
  p_status      text,
  p_document_id uuid default null,
  p_reason      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
begin
  if p_status not in ('pending','collected','verified','waived') then
    raise exception 'invalid status %', p_status;
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('preboarding.manage') then raise exception 'not_authorized'; end if;

  update public.tas_preboarding_item
    set status        = p_status,
        document_id   = coalesce(p_document_id, document_id),
        waived_reason = case when p_status = 'waived' then p_reason else null end,
        collected_at  = case when p_status in ('collected','verified') then coalesce(collected_at, now()) else collected_at end,
        verified_at   = case when p_status = 'verified' then now() else null end,
        updated_by    = v_caller
  where id = p_item_id;
  if not found then raise exception 'item % not found', p_item_id; end if;

  perform public.audit_log(v_caller, 'M1.10', 'preboarding.item_set', 'preboarding_item', p_item_id::text,
    jsonb_build_object('status', p_status));
end;
$$;

-- complete_preboarding — require all required items resolved.
create or replace function public.complete_preboarding(p_preboarding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid;
  v_pending int;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  if not public._has_permission('preboarding.manage') then raise exception 'not_authorized'; end if;

  select count(*) into v_pending
  from public.tas_preboarding_item
  where preboarding_id = p_preboarding_id
    and required = true
    and status not in ('collected','verified','waived');

  if v_pending > 0 then
    raise exception 'preboarding_incomplete'
      using message = 'All required documents must be collected, verified, or waived before completing.';
  end if;

  update public.tas_preboarding
    set status = 'completed', completed_at = now(), completed_by = v_caller, updated_by = v_caller
  where id = p_preboarding_id;
  if not found then raise exception 'preboarding % not found', p_preboarding_id; end if;

  perform public.audit_log(v_caller, 'M1.10', 'preboarding.completed', 'preboarding', p_preboarding_id::text, '{}'::jsonb);
end;
$$;

-- preboarding_detail — read (open).
create or replace function public.preboarding_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'preboarding', (select to_jsonb(pb) from public.tas_preboarding pb where pb.id = p_id),
    'candidate', (
      select jsonb_build_object('id', c.id, 'full_name_en', c.full_name_en,
                                'full_name_ar', c.full_name_ar, 'email', c.email)
      from public.tas_candidate c
      join public.tas_preboarding pb on pb.candidate_id = c.id where pb.id = p_id
    ),
    'application', (
      select jsonb_build_object('id', a.id, 'reference', a.reference, 'status', a.status)
      from public.tas_application a
      join public.tas_preboarding pb on pb.application_id = a.id where pb.id = p_id
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'doc_category', i.doc_category, 'label_en', i.label_en, 'label_ar', i.label_ar,
        'required', i.required, 'status', i.status, 'document_id', i.document_id,
        'waived_reason', i.waived_reason, 'collected_at', i.collected_at, 'verified_at', i.verified_at
      ) order by i.required desc, i.doc_category)
      from public.tas_preboarding_item i where i.preboarding_id = p_id
    ), '[]'::jsonb)
  );
$$;

-- list_preboarding — read (open).
create or replace function public.list_preboarding(
  p_status text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table(
  id                uuid,
  application_id    uuid,
  candidate_id      uuid,
  candidate_name_en text,
  candidate_name_ar text,
  reference         text,
  status            text,
  required_total    bigint,
  required_done     bigint,
  started_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select pb.id, pb.application_id, pb.candidate_id,
         c.full_name_en, c.full_name_ar, a.reference, pb.status,
         count(i.*) filter (where i.required),
         count(i.*) filter (where i.required and i.status in ('collected','verified','waived')),
         pb.started_at
  from public.tas_preboarding pb
  left join public.tas_candidate c on c.id = pb.candidate_id
  left join public.tas_application a on a.id = pb.application_id
  left join public.tas_preboarding_item i on i.preboarding_id = pb.id
  where (p_status is null or pb.status = p_status)
  group by pb.id, c.full_name_en, c.full_name_ar, a.reference
  order by pb.started_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- 6. GRANTS
-- -----------------------------------------------------------------------------
grant execute on function public.start_preboarding(uuid)                         to authenticated;
grant execute on function public.set_preboarding_item(uuid, text, uuid, text)    to authenticated;
grant execute on function public.complete_preboarding(uuid)                      to authenticated;
grant execute on function public.preboarding_detail(uuid)                        to authenticated;
grant execute on function public.list_preboarding(text, int, int)               to authenticated;

-- =============================================================================
-- End of M1.10 — Pre-Boarding & Document Collection.
-- =============================================================================
