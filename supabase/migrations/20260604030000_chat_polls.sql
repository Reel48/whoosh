-- Interactive polls. A poll is a chat_message with kind='poll' and
--   data = { question, multi: bool, options: [{id,text}], counts: {id: n} }.
-- Votes live in chat_poll_vote; vote_chat_poll recomputes counts and writes them
-- back into the message's data so the tallies ride the existing chat_message
-- UPDATE realtime broadcast (no new subscription needed). The viewer's own
-- selections are enriched per-load by the chat lib.

create table if not exists public.chat_poll_vote (
  message_id bigint not null references public.chat_message(id) on delete cascade,
  option_id text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, option_id)
);
create index if not exists chat_poll_vote_msg_idx on public.chat_poll_vote(message_id);
alter table public.chat_poll_vote enable row level security;
-- No policies: only the SECURITY DEFINER RPC below touches this table.

create or replace function public.vote_chat_poll(p_user uuid, p_message bigint, p_option text, p_on boolean)
returns table (counts jsonb, mine text[])
language plpgsql security definer set search_path = public as $$
declare
  v_channel bigint; v_kind text; v_data jsonb; v_multi boolean; v_options jsonb; v_valid boolean;
begin
  select m.channel_id, m.kind, m.data into v_channel, v_kind, v_data
    from chat_message m where m.id = p_message and m.deleted_at is null;
  if v_channel is null then raise exception 'not_found'; end if;
  if v_kind <> 'poll' then raise exception 'validation'; end if;
  if not chat_can_read(v_channel, p_user) then raise exception 'forbidden'; end if;

  v_options := coalesce(v_data->'options', '[]'::jsonb);
  v_multi := coalesce((v_data->>'multi')::boolean, false);
  select exists (select 1 from jsonb_array_elements(v_options) o where o->>'id' = p_option) into v_valid;
  if not v_valid then raise exception 'validation'; end if;

  if p_on then
    if not v_multi then
      delete from chat_poll_vote v where v.message_id = p_message and v.user_id = p_user;
    end if;
    insert into chat_poll_vote (message_id, option_id, user_id)
      values (p_message, p_option, p_user) on conflict do nothing;
  else
    delete from chat_poll_vote v
      where v.message_id = p_message and v.user_id = p_user and v.option_id = p_option;
  end if;

  -- Recompute every option's count (0 for un-voted) and persist into data.counts.
  with c as (
    select v.option_id, count(*)::int n from chat_poll_vote v where v.message_id = p_message group by v.option_id
  )
  select coalesce(
           jsonb_object_agg(o->>'id', coalesce((select n from c where c.option_id = o->>'id'), 0)),
           '{}'::jsonb)
    into counts
  from jsonb_array_elements(v_options) o;

  update chat_message m
     set data = jsonb_set(coalesce(m.data, '{}'::jsonb), '{counts}', counts)
   where m.id = p_message;

  select coalesce(array_agg(v.option_id), '{}') into mine
    from chat_poll_vote v where v.message_id = p_message and v.user_id = p_user;
  return next;
end; $$;

grant execute on function public.vote_chat_poll(uuid, bigint, text, boolean) to authenticated, service_role;
