-- Structured message types. Today a chat_message is just text + an optional
-- image; this adds a `kind` discriminator + a `data` jsonb payload so chat can
-- carry spoilers, stock/bet cards, polls, gifs, and files. Backward-compatible:
-- existing rows default to 'text', and every structured message still sets a
-- human-readable `body` so old clients, full-text search, DM previews, and push
-- all degrade to text. chat_message already has replica identity FULL and is in
-- the supabase_realtime publication, so the new columns flow to Realtime as-is.

alter table public.chat_message
  add column if not exists kind text not null default 'text',
  add column if not exists data jsonb;

alter table public.chat_message drop constraint if exists chat_message_kind_check;
alter table public.chat_message
  add constraint chat_message_kind_check
  check (kind in ('text','image','gif','spoiler','stock','bet','poll','file'));

-- Extend send_chat_message with kind + data. The old 5-arg overload is dropped
-- and replaced by a single 7-arg version whose new params are DEFAULTED, so any
-- existing 5-arg caller keeps working unchanged. Body otherwise identical to the
-- prior (column-qualified) version; only the validity guard + insert change.
drop function if exists public.send_chat_message(uuid, bigint, text, text, bigint);

create or replace function public.send_chat_message(
  p_user uuid, p_channel bigint, p_body text, p_image_url text, p_reply_to bigint,
  p_kind text default 'text', p_data jsonb default null
)
returns table (id bigint, created_at timestamptz, level integer, leveled_up boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_policy text; v_is_admin boolean; v_msg_id bigint; v_created timestamptz; v_handle text;
  v_old_level integer; v_new_level integer; v_grant integer := 0; v_now timestamptz := now();
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'text');
begin
  -- Valid with text, an image, OR a structured data payload.
  if coalesce(nullif(btrim(p_body), ''), p_image_url, p_data::text) is null then raise exception 'empty message'; end if;
  if not chat_can_read(p_channel, p_user) then raise exception 'forbidden'; end if;
  select c.post_policy into v_policy from chat_channel c where c.id = p_channel;
  select coalesce((select pr.is_admin from profile pr where pr.user_id = p_user), false) into v_is_admin;
  if v_policy = 'system' then raise exception 'forbidden';
  elsif v_policy = 'admins' and not v_is_admin then raise exception 'forbidden';
  end if;
  insert into chat_message (channel_id, user_id, body, image_url, reply_to_id, kind, data)
  values (p_channel, p_user, coalesce(btrim(p_body), ''), nullif(p_image_url, ''), p_reply_to, v_kind, p_data)
  returning chat_message.id, chat_message.created_at into v_msg_id, v_created;
  for v_handle in select distinct lower(m[1]) from regexp_matches(coalesce(p_body, ''), '@([A-Za-z0-9_]{3,20})', 'g') as m loop
    insert into chat_mention (message_id, mentioned_user_id)
    select v_msg_id, pr.user_id from profile pr where lower(pr.username) = v_handle on conflict do nothing;
  end loop;
  insert into chat_user_stat (user_id, xp, message_count, level, last_xp_at, updated_at)
  values (p_user, 0, 0, 0, null, v_now) on conflict (user_id) do nothing;
  select s.level into v_old_level from chat_user_stat s where s.user_id = p_user;
  select case when s.last_xp_at is null or s.last_xp_at < v_now - interval '60 seconds' then 15 else 0 end
    into v_grant from chat_user_stat s where s.user_id = p_user;
  update chat_user_stat s
     set message_count = s.message_count + 1, xp = s.xp + v_grant,
         last_xp_at = case when v_grant > 0 then v_now else s.last_xp_at end,
         level = chat_level_for_xp(s.xp + v_grant), updated_at = v_now
   where s.user_id = p_user;
  select s.level into v_new_level from chat_user_stat s where s.user_id = p_user;
  return query select v_msg_id, v_created, v_new_level, (v_new_level > v_old_level);
end; $$;

grant execute on function public.send_chat_message(uuid,bigint,text,text,bigint,text,jsonb) to authenticated, service_role;
