-- Chat notifications, riding the existing per-user `notification` feed.
--
--  • Extend the `kind` CHECK with 'chat_mention' + 'chat_dm'.
--  • Emit notifications transactionally inside `send_chat_message` (so a message
--    and its notifications commit together) for @mentions (to users who can read
--    the channel) and for DM recipients.
--  • Add a self-read RLS SELECT policy + publish to Realtime so the iOS client
--    gets live in-app notifications.

-- 1) Widen the kind CHECK (drop the existing one by name, then re-add).
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
   where conrelid = 'public.notification'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind%' limit 1;
  if v_name is not null then
    execute format('alter table public.notification drop constraint %I', v_name);
  end if;
end $$;

alter table public.notification add constraint notification_kind_check check (kind in (
  'bet_settled','dividend','transfer_in','interest_posted','achievement',
  'renewal','referral','system','chat_mention','chat_dm'
));

-- 2) Self-read policy + Realtime publication (RLS is already enabled).
drop policy if exists notification_read_self on public.notification;
create policy notification_read_self on public.notification for select to authenticated
  using (discord_user_id = auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='notification'
  ) then
    execute 'alter publication supabase_realtime add table public.notification';
  end if;
end $$;

-- 3) Emit chat notifications from send_chat_message (full redefinition; the only
--    additions vs the prior version are v_sender/v_kind and the two inserts).
create or replace function public.send_chat_message(p_user uuid, p_channel bigint, p_body text, p_image_url text, p_reply_to bigint)
returns table (id bigint, created_at timestamptz, level integer, leveled_up boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_policy text; v_is_admin boolean; v_msg_id bigint; v_created timestamptz; v_handle text;
  v_old_level integer; v_new_level integer; v_grant integer := 0; v_now timestamptz := now();
  v_sender text; v_kind text;
begin
  if coalesce(nullif(btrim(p_body), ''), p_image_url) is null then raise exception 'empty message'; end if;
  if not chat_can_read(p_channel, p_user) then raise exception 'forbidden'; end if;
  select c.post_policy, c.kind into v_policy, v_kind from chat_channel c where c.id = p_channel;
  select coalesce((select pr.is_admin from profile pr where pr.user_id = p_user), false) into v_is_admin;
  if v_policy = 'system' then raise exception 'forbidden';
  elsif v_policy = 'admins' and not v_is_admin then raise exception 'forbidden';
  end if;
  insert into chat_message (channel_id, user_id, body, image_url, reply_to_id)
  values (p_channel, p_user, coalesce(btrim(p_body), ''), nullif(p_image_url, ''), p_reply_to)
  returning chat_message.id, chat_message.created_at into v_msg_id, v_created;

  for v_handle in select distinct lower(m[1]) from regexp_matches(coalesce(p_body, ''), '@([A-Za-z0-9_]{3,20})', 'g') as m loop
    insert into chat_mention (message_id, mentioned_user_id)
    select v_msg_id, pr.user_id from profile pr where lower(pr.username) = v_handle on conflict do nothing;
  end loop;

  -- Notifications (chat_mention + chat_dm). Sender handle for the title.
  select pr.username into v_sender from profile pr where pr.user_id = p_user;

  insert into notification (discord_user_id, kind, title, body, href, metadata)
  select cm.mentioned_user_id::text, 'chat_mention',
         '@' || coalesce(v_sender, 'Someone') || ' mentioned you',
         left(coalesce(p_body, ''), 140),
         'chat:' || p_channel::text || ':' || v_msg_id::text,
         jsonb_build_object('channelId', p_channel, 'messageId', v_msg_id)
    from chat_mention cm
   where cm.message_id = v_msg_id
     and cm.mentioned_user_id <> p_user
     and chat_can_read(p_channel, cm.mentioned_user_id);

  if v_kind = 'dm' then
    insert into notification (discord_user_id, kind, title, body, href, metadata)
    select mem.user_id::text, 'chat_dm',
           '@' || coalesce(v_sender, 'Someone') || ' sent you a message',
           left(coalesce(p_body, ''), 140),
           'chat:' || p_channel::text || ':' || v_msg_id::text,
           jsonb_build_object('channelId', p_channel, 'messageId', v_msg_id)
      from chat_channel_member mem
     where mem.channel_id = p_channel and mem.user_id <> p_user;
  end if;

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
