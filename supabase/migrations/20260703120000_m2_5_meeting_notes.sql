-- =============================================================================
-- Al Hamra TAS — Module M2.5: Interview Meeting Notes + AI Summarization
-- =============================================================================
-- Meeting notes attached to an interview (M1.7). A note holds the raw
-- transcript/notes text; the AI copilot (M2.1 Lovable AI gateway, DORMANT until
-- the 'llm' adapter is enabled) summarizes it into a bilingual summary + key
-- points + a recommendation, persisted back onto the note by the ai-copilot edge
-- function (service role). Writes via SECURITY DEFINER RPCs: note authoring gates
-- interview.score, summarization gates ai.use. Reads authenticated. No new
-- capability key, no storage bucket SQL, no recursive CTEs.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.tas_interview_note (
  id             uuid primary key default gen_random_uuid(),
  interview_id   uuid not null references public.tas_interview(id) on delete cascade,
  raw_text       text,
  summary_en     text,
  summary_ar     text,
  key_points     jsonb not null default '[]'::jsonb,
  recommendation text check (recommendation in ('proceed','hold','reject')),
  ai_generated   boolean not null default false,
  author_user_id uuid references public.tas_user(id),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table public.tas_interview_note is 'Meeting notes for an interview; AI-summarized via the M2.1 copilot (dormant until enabled).';
create index if not exists idx_tas_interview_note_interview on public.tas_interview_note(interview_id, created_at desc);

drop trigger if exists trg_tas_interview_note_updated_at on public.tas_interview_note;
create trigger trg_tas_interview_note_updated_at before update on public.tas_interview_note
  for each row execute function public.tas_set_updated_at();

alter table public.tas_interview_note enable row level security;
drop policy if exists tas_interview_note_select_auth on public.tas_interview_note;
create policy tas_interview_note_select_auth on public.tas_interview_note
  for select to authenticated using (true);
grant select on public.tas_interview_note to authenticated;

-- list_interview_notes — authenticated read of an interview's notes, newest first.
create or replace function public.list_interview_notes(p_interview_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return (
    select coalesce(jsonb_agg(obj order by ca desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', id, 'interview_id', interview_id, 'raw_text', raw_text,
        'summary_en', summary_en, 'summary_ar', summary_ar, 'key_points', key_points,
        'recommendation', recommendation, 'ai_generated', ai_generated, 'created_at', created_at
      ) as obj, created_at as ca
      from public.tas_interview_note where interview_id = p_interview_id
    ) t
  );
end; $$;

-- save_interview_note — author a raw note (gate interview.score).
create or replace function public.save_interview_note(p_interview_id uuid, p_raw_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_id uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('interview.score') then raise exception 'not_authorized'; end if;
  if p_raw_text is null or length(btrim(p_raw_text)) = 0 then raise exception 'empty_note'; end if;

  insert into public.tas_interview_note (interview_id, raw_text, author_user_id, created_by, updated_by)
  values (p_interview_id, p_raw_text, v_caller, v_caller, v_caller)
  returning id into v_id;

  perform public.audit_log(v_caller, 'M2.5', 'interview.note_saved', 'interview', p_interview_id::text,
    jsonb_build_object('note_id', v_id));
  return v_id;
end; $$;

-- ai_summarize_meeting — dormant-aware gate for AI summarization (gate ai.use).
-- Returns { dormant, message }. The ai-copilot edge function performs the real
-- summarization + persistence when not dormant (invoked client-side after this).
create or replace function public.ai_summarize_meeting(p_note_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_enabled boolean; v_interview uuid;
begin
  select u.id into v_caller from public.tas_user u
  where u.entra_object_id = (auth.jwt() ->> 'oid') or u.email = nullif(auth.jwt() ->> 'email','')::citext limit 1;
  if not public._has_permission('ai.use') then raise exception 'not_authorized'; end if;

  select interview_id into v_interview from public.tas_interview_note where id = p_note_id;
  if v_interview is null then raise exception 'note_not_found'; end if;

  select is_enabled into v_enabled from public.tas_ai_adapter_config where provider = 'llm';

  perform public.audit_log(v_caller, 'M2.5', 'ai.summarize_meeting', 'ai', 'llm',
    jsonb_build_object('note_id', p_note_id, 'enabled', coalesce(v_enabled,false)));

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('dormant', true, 'output', null,
      'message', 'AI copilot is dormant. Enable the AI adapter in System Settings to use it.');
  end if;
  return jsonb_build_object('dormant', false, 'output', null, 'message', 'accepted');
end; $$;

grant execute on function public.list_interview_notes(uuid)     to authenticated;
grant execute on function public.save_interview_note(uuid, text) to authenticated;
grant execute on function public.ai_summarize_meeting(uuid)      to authenticated;

-- =============================================================================
-- End of M2.5 — Interview Meeting Notes + AI Summarization.
-- =============================================================================
