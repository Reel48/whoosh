-- Welcome chat. When a user finishes onboarding, the WhooshNews bot posts an
-- "avatar card" into the #welcome channel (kind='welcome', data {username,
-- avatarUrl}) that @mentions the newcomer so others are nudged to welcome them.
-- A dedup table guarantees one welcome per user. Mirrors the post_news_article
-- system-bot pattern.

-- Allow the new 'welcome' message kind.
alter table public.chat_message drop constraint if exists chat_message_kind_check;
alter table public.chat_message
  add constraint chat_message_kind_check
  check (kind in ('text','image','gif','spoiler','stock','bet','poll','file','welcome'));

create table if not exists public.welcome_post (
  user_id uuid primary key,
  posted_at timestamptz not null default now()
);
alter table public.welcome_post enable row level security;

create or replace function public.post_welcome_message(p_user uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_channel bigint; v_username text; v_avatar text; v_msg_id bigint;
  v_sys uuid := '00000000-0000-4000-8000-000000000001';
begin
  insert into welcome_post (user_id) values (p_user) on conflict do nothing;
  if not found then return null; end if;   -- already welcomed

  select pr.username, pr.avatar_url into v_username, v_avatar from profile pr where pr.user_id = p_user;
  if v_username is null then return null; end if;

  select c.id into v_channel from chat_channel c where c.slug = 'welcome' and c.is_active limit 1;
  if v_channel is null then return null; end if;

  insert into chat_message (channel_id, user_id, body, kind, data)
  values (
    v_channel, v_sys,
    '👋 Everyone welcome @' || v_username || ' to Whoosh!',
    'welcome',
    jsonb_build_object('username', v_username, 'avatarUrl', v_avatar)
  )
  returning id into v_msg_id;

  -- @mention the newcomer (direct insert skips send_chat_message's parsing).
  insert into chat_mention (message_id, mentioned_user_id)
  values (v_msg_id, p_user) on conflict do nothing;
  return v_msg_id;
end; $$;

grant execute on function public.post_welcome_message(uuid) to authenticated, service_role;
