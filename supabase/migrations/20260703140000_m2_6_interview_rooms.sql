-- =============================================================================
-- Al Hamra TAS — Module M2.6: Interview room booking + shareable calendar link
-- =============================================================================
-- Extends M1.7 interviews so an in-person interview can book a Microsoft 365 room
-- resource (e.g. "Fai"), and stores the created Outlook event's web link for the
-- recruiter/admin to share. The room is booked by the interview-schedule edge
-- function, which invites the room mailbox as a resource attendee (Graph) — no new
-- DB permission. Rooms are discovered from Graph (/places) by the graph-rooms edge
-- function. All Graph work stays DORMANT until M365 secrets are set.
-- No storage bucket SQL, no recursive CTEs.
-- =============================================================================

alter table public.tas_interview
  add column if not exists room_email       text,
  add column if not exists room_name        text,
  add column if not exists outlook_web_link text;

comment on column public.tas_interview.room_email is 'M365 room mailbox invited as a resource attendee for in-person interviews (M2.6).';
comment on column public.tas_interview.outlook_web_link is 'Outlook web link (OWA) of the created calendar event, for sharing (M2.6).';

-- set_interview_room — attach a chosen room to an interview before the calendar
-- adapter runs. Authenticated (matches schedule_interview posture; M3.1 tightens).
create or replace function public.set_interview_room(p_interview_id uuid, p_room_email text, p_room_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;

  update public.tas_interview
     set room_email = nullif(btrim(p_room_email), ''),
         room_name  = nullif(btrim(p_room_name), ''),
         updated_by = v_caller
   where id = p_interview_id;
  if not found then raise exception 'interview % not found', p_interview_id; end if;

  perform public.audit_log(v_caller, 'M2.6', 'interview.room_set', 'interview', p_interview_id::text,
    jsonb_build_object('room_email', p_room_email));
end; $$;

grant execute on function public.set_interview_room(uuid, text, text) to authenticated;

-- =============================================================================
-- End of M2.6 — Interview room booking + shareable calendar link.
-- =============================================================================
