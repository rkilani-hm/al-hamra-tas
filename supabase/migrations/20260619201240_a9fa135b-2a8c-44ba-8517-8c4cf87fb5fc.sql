-- =============================================================================
-- Al Hamra TAS — Module M1.9 RPCs: Offer Management
-- =============================================================================

create or replace function public.submit_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer    public.tas_offer;
  v_entity   uuid;
  v_branch   uuid;
  v_dept     uuid;
  v_instance uuid;
  v_cand_en  text;
  v_requester uuid;
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;
  if v_offer.status <> 'draft' then
    raise exception 'only draft offers can be submitted (current: %)', v_offer.status;
  end if;
  if v_offer.salary_amount is null or v_offer.candidate_id is null or v_offer.application_id is null then
    raise exception 'offer is missing required fields (salary, candidate, application)';
  end if;

  if not exists (
    select 1 from public.tas_workflow_definition where request_type = 'offer' and status = 'active'
  ) then
    insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_offer_id, 'submit_blocked', v_offer.status, v_offer.status, v_offer.created_by,
            jsonb_build_object('reason', 'no active offer workflow definition'));
    raise exception 'no active offer workflow definition';
  end if;

  select r.entity_id, r.branch_id, r.department_id into v_entity, v_branch, v_dept
  from public.tas_application a
  join public.tas_requisition r on r.id = a.requisition_id
  where a.id = v_offer.application_id;

  v_requester := v_offer.created_by;

  v_instance := public.submit_workflow(
    'offer', p_offer_id::text, v_requester,
    v_entity, v_branch, v_dept,
    jsonb_build_object('salary_amount', v_offer.salary_amount,
                       'contract_type', v_offer.contract_type,
                       'grade', v_offer.job_grade_id)
  );

  update public.tas_offer
    set status = 'in_approval', workflow_instance_id = v_instance, updated_by = v_requester
  where id = p_offer_id;

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, 'submitted', 'draft', 'in_approval', v_requester,
          jsonb_build_object('workflow_instance_id', v_instance));

  perform public.audit_log(v_requester, 'M1.9', 'offer.submitted', 'offer', p_offer_id::text,
    jsonb_build_object('reference', v_offer.reference, 'workflow_instance_id', v_instance));

  select full_name_en into v_cand_en from public.tas_candidate where id = v_offer.candidate_id;
  if v_requester is not null then
    perform public.notify('offer.submitted', array[v_requester],
      jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                         'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                         'status', 'in_approval'),
      '/app/offers/' || p_offer_id::text);
  end if;

  return v_instance;
end;
$$;

create or replace function public.sync_offer_status(p_offer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer       public.tas_offer;
  v_inst_status text;
  v_new         text;
  v_cand_en     text;
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then return null; end if;
  if v_offer.workflow_instance_id is null then return v_offer.status; end if;

  select status into v_inst_status from public.tas_workflow_instance where id = v_offer.workflow_instance_id;

  v_new := case v_inst_status
    when 'approved' then 'approved'
    when 'rejected' then 'cancelled'
    when 'returned' then 'draft'
    else null
  end;

  if v_new is null or v_new = v_offer.status then
    return v_offer.status;
  end if;

  update public.tas_offer set status = v_new where id = p_offer_id;

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, 'status_synced', v_offer.status, v_new, null,
          jsonb_build_object('instance_status', v_inst_status));

  perform public.audit_log(v_offer.created_by, 'M1.9', 'offer.' || v_new, 'offer', p_offer_id::text,
    jsonb_build_object('from', v_offer.status, 'to', v_new));

  select full_name_en into v_cand_en from public.tas_candidate where id = v_offer.candidate_id;
  if v_offer.created_by is not null and v_new in ('approved','cancelled') then
    perform public.notify(
      case v_new when 'approved' then 'offer.approved' else 'offer.rejected' end,
      array[v_offer.created_by],
      jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                         'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                         'status', v_new),
      '/app/offers/' || p_offer_id::text);
  end if;

  return v_new;
end;
$$;

create or replace function public.issue_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer   public.tas_offer;
  v_caller  uuid;
  v_cand_en text;
  v_cand_ar text;
  v_snap    jsonb;
  v_esign   text := 'skipped';
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;
  if v_offer.status <> 'approved' then
    raise exception 'only approved offers can be issued (current: %)', v_offer.status
      using message = 'This offer must be approved before it can be issued.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  select full_name_en, full_name_ar into v_cand_en, v_cand_ar
  from public.tas_candidate where id = v_offer.candidate_id;

  v_snap := jsonb_build_object(
    'reference', v_offer.reference,
    'candidate_en', coalesce(v_cand_en, ''),
    'candidate_ar', coalesce(v_cand_ar, ''),
    'salary_amount', v_offer.salary_amount,
    'currency', v_offer.currency,
    'start_date', v_offer.start_date,
    'contract_type', v_offer.contract_type,
    'employment_type', v_offer.employment_type,
    'probation_months', v_offer.probation_months,
    'terms_en', v_offer.terms_en,
    'terms_ar', v_offer.terms_ar,
    'title_en', 'Offer of Employment',
    'title_ar', 'عرض عمل',
    'body_en', 'Dear ' || coalesce(v_cand_en, 'Candidate') ||
               ', we are pleased to offer you employment with Al Hamra Real Estate Group at a salary of ' ||
               coalesce(v_offer.salary_amount::text, '') || ' ' || v_offer.currency ||
               coalesce(', starting ' || v_offer.start_date::text, '') || '.',
    'body_ar', 'عزيزي ' || coalesce(v_cand_ar, v_cand_en, 'المرشح') ||
               '، يسعدنا أن نقدم لك عرض عمل لدى مجموعة الحمراء العقارية براتب قدره ' ||
               coalesce(v_offer.salary_amount::text, '') || ' ' || v_offer.currency ||
               coalesce('، اعتباراً من ' || v_offer.start_date::text, '') || '.'
  );

  update public.tas_offer
    set status = 'issued', letter_snapshot_json = v_snap, esign_status = v_esign, updated_by = v_caller
  where id = p_offer_id;

  insert into public.tas_document
    (title, category, linked_entity_type, linked_entity_ref, storage_provider, file_name, status, uploaded_by, created_by)
  values
    ('Offer Letter ' || coalesce(v_offer.reference, ''), 'offer_letter', 'offer', p_offer_id::text,
     'supabase_storage', 'offer-' || coalesce(v_offer.reference, p_offer_id::text) || '.txt',
     'active', v_caller, v_caller);

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, 'issued', 'approved', 'issued', v_caller, jsonb_build_object('esign_status', v_esign));

  perform public.audit_log(v_caller, 'M1.9', 'offer.issued', 'offer', p_offer_id::text,
    jsonb_build_object('reference', v_offer.reference, 'esign_status', v_esign));

  if v_offer.created_by is not null then
    perform public.notify('offer.issued', array[v_offer.created_by],
      jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                         'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                         'status', 'issued'),
      '/app/offers/' || p_offer_id::text);
  end if;
end;
$$;

create or replace function public.respond_to_offer(
  p_offer_id   uuid,
  p_decision   text,
  p_reason     text default null,
  p_signature  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer   public.tas_offer;
  v_caller  uuid;
  v_stage   uuid;
  v_moved   boolean := false;
  v_message text := '';
  v_cand_en text;
  v_esign   text;
begin
  if p_decision not in ('accept','decline') then
    raise exception 'invalid decision %', p_decision;
  end if;

  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;
  if v_offer.status <> 'issued' then
    raise exception 'only issued offers can be responded to (current: %)', v_offer.status
      using message = 'This offer must be issued before recording a response.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  select full_name_en into v_cand_en from public.tas_candidate where id = v_offer.candidate_id;

  if p_decision = 'accept' then
    v_esign := case when nullif(p_signature,'') is not null then 'signed' else v_offer.esign_status end;
    update public.tas_offer
      set status = 'accepted', accepted_at = now(), esign_status = v_esign,
          onboarding_ready = true, updated_by = v_caller
    where id = p_offer_id;

    select id into v_stage from public.tas_pipeline_stage
    where status = 'active' and (stage_type = 'hired' or code = 'hired') order by sort_order limit 1;
    if v_stage is not null then
      perform public.move_application_stage(v_offer.application_id, v_stage, 'Offer accepted');
      v_moved := true;
    else
      perform public.set_application_status(v_offer.application_id, 'hired', 'Offer accepted');
      v_moved := true;
      v_message := 'hired_via_status';
    end if;

    insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_offer_id, 'accepted', 'issued', 'accepted', v_caller,
            jsonb_build_object('moved', v_moved, 'message', v_message));

    perform public.audit_log(v_caller, 'M1.9', 'offer.accepted', 'offer', p_offer_id::text,
      jsonb_build_object('reference', v_offer.reference, 'moved', v_moved));

    if v_offer.created_by is not null then
      perform public.notify('offer.accepted', array[v_offer.created_by],
        jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                           'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                           'status', 'accepted'),
        '/app/offers/' || p_offer_id::text);
    end if;

  else
    update public.tas_offer
      set status = 'declined', declined_reason = p_reason, updated_by = v_caller
    where id = p_offer_id;

    insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
    values (p_offer_id, 'declined', 'issued', 'declined', v_caller, jsonb_build_object('reason', p_reason));

    perform public.audit_log(v_caller, 'M1.9', 'offer.declined', 'offer', p_offer_id::text,
      jsonb_build_object('reference', v_offer.reference, 'reason', p_reason));

    if v_offer.created_by is not null then
      perform public.notify('offer.declined', array[v_offer.created_by],
        jsonb_build_object('reference', v_offer.reference, 'candidate', coalesce(v_cand_en,''),
                           'salary', coalesce(v_offer.salary_amount::text,'') || ' ' || v_offer.currency,
                           'status', 'declined'),
        '/app/offers/' || p_offer_id::text);
    end if;
  end if;

  return jsonb_build_object('offer_id', p_offer_id, 'decision', p_decision,
                            'application_id', v_offer.application_id, 'moved', v_moved, 'message', v_message);
end;
$$;

create or replace function public.transition_offer(p_offer_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer  public.tas_offer;
  v_new    text;
  v_caller uuid;
begin
  select * into v_offer from public.tas_offer where id = p_offer_id;
  if v_offer.id is null then raise exception 'offer % not found', p_offer_id; end if;

  v_new := case p_action
    when 'cancel' then 'cancelled'
    when 'expire' then 'expired'
    else null
  end;
  if v_new is null then raise exception 'invalid action %', p_action; end if;

  if v_offer.status in ('accepted','declined','cancelled','expired') then
    raise exception 'cannot % an offer in status %', p_action, v_offer.status
      using message = 'This offer is already finalized.';
  end if;

  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid')
     or u.email = nullif(auth.jwt() ->> 'email','')::citext
  limit 1;

  update public.tas_offer set status = v_new, updated_by = v_caller where id = p_offer_id;

  insert into public.tas_offer_event (offer_id, event_type, from_status, to_status, actor_user_id, detail_json)
  values (p_offer_id, p_action, v_offer.status, v_new, v_caller, '{}'::jsonb);

  perform public.audit_log(v_caller, 'M1.9', 'offer.' || p_action, 'offer', p_offer_id::text,
    jsonb_build_object('from', v_offer.status, 'to', v_new));
end;
$$;

create or replace function public.offer_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'offer', (select to_jsonb(o) from public.tas_offer o where o.id = p_id),
    'application', (
      select jsonb_build_object('id', a.id, 'reference', a.reference, 'status', a.status,
                                'current_stage_id', a.current_stage_id)
      from public.tas_application a
      join public.tas_offer o on o.application_id = a.id where o.id = p_id
    ),
    'candidate', (
      select jsonb_build_object('id', c.id, 'full_name_en', c.full_name_en,
                                'full_name_ar', c.full_name_ar, 'email', c.email)
      from public.tas_candidate c
      join public.tas_offer o on o.candidate_id = c.id where o.id = p_id
    ),
    'instance', (
      select jsonb_build_object('instance', to_jsonb(i))
      from public.tas_workflow_instance i
      join public.tas_offer o on o.workflow_instance_id = i.id where o.id = p_id
    ),
    'letter_snapshot', (select o.letter_snapshot_json from public.tas_offer o where o.id = p_id),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'from_status', e.from_status,
        'to_status', e.to_status, 'created_at', e.created_at
      ) order by e.created_at)
      from public.tas_offer_event e where e.offer_id = p_id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.list_offers(
  p_application_id uuid    default null,
  p_candidate_id   uuid    default null,
  p_status         text    default null,
  p_mine           boolean default false,
  p_limit          int     default 50,
  p_offset         int     default 0
)
returns table(
  id                uuid,
  reference         text,
  application_id    uuid,
  candidate_id      uuid,
  candidate_name_en text,
  candidate_name_ar text,
  salary_amount     numeric,
  currency          text,
  status            text,
  esign_status      text,
  onboarding_ready  boolean,
  created_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id from public.tas_user u
    where u.entra_object_id = (auth.jwt() ->> 'oid')
       or u.email = nullif(auth.jwt() ->> 'email','')::citext
    limit 1
  )
  select o.id, o.reference, o.application_id, o.candidate_id,
         c.full_name_en, c.full_name_ar, o.salary_amount, o.currency, o.status,
         o.esign_status, o.onboarding_ready, o.created_at
  from public.tas_offer o
  left join public.tas_candidate c on c.id = o.candidate_id
  where (p_application_id is null or o.application_id = p_application_id)
    and (p_candidate_id is null or o.candidate_id = p_candidate_id)
    and (p_status is null or o.status = p_status)
    and (not coalesce(p_mine, false) or o.created_by in (select id from me))
  order by o.created_at desc
  limit greatest(coalesce(p_limit, 50), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.sync_offer_status(uuid)                          to authenticated;
grant execute on function public.offer_detail(uuid)                               to authenticated;
grant execute on function public.list_offers(uuid, uuid, text, boolean, int, int) to authenticated;

revoke execute on function public.submit_offer(uuid)                  from public;
revoke execute on function public.issue_offer(uuid)                   from public;
revoke execute on function public.respond_to_offer(uuid, text, text, text) from public;
revoke execute on function public.transition_offer(uuid, text)        from public;
revoke execute on function public.generate_offer_ref()                from public;