-- News → chat bridge: when enough distinct users *keep* the same article, it
-- auto-posts into the matching sport's chat channel, authored by a "Whoosh News"
-- system bot. This migration seeds the bot identity, a dedup table guaranteeing
-- one post per article, and the SECURITY DEFINER RPC that performs the post.

-- 1) System author. profile.user_id FKs auth.users, so seed a real auth.users row
--    (fixed UUID, deterministic). The handle_new_user trigger auto-creates the
--    profile from this row — app_meta provider=email so its has_password derives
--    cleanly — then we rename that profile to "WhooshNews" (the username format
--    forbids spaces). Profile drives chat author enrichment (name + avatar).
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'news-bot@whoosh.internal',
  '{"provider":"email","providers":["email"]}'::jsonb, now(), now()
) on conflict (id) do nothing;

update profile
   set username = 'WhooshNews', onboarded_at = coalesce(onboarded_at, now())
 where user_id = '00000000-0000-4000-8000-000000000001';

-- 2) Dedup table — one auto-post per ESPN article, ever. The PK + ON CONFLICT in
--    the RPC make crossing the threshold idempotent even under concurrency.
create table if not exists public.news_chat_post (
  espn_id text primary key,
  posted_at timestamptz not null default now()
);
alter table public.news_chat_post enable row level security;
-- No policies: only the SECURITY DEFINER RPC (which bypasses RLS) touches it.

-- 3) The post RPC. Resolves the channel first (so a bad slug never burns a dedup
--    slot), then claims the dedup row, then inserts the message as the bot.
--    Deliberately NOT send_chat_message: no XP, no mention parsing, no policy
--    gate (it's a system post). Realtime auto-broadcasts the insert.
create or replace function public.post_news_article(
  p_espn_id text, p_channel_slug text, p_body text, p_image_url text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_channel bigint;
  v_msg_id bigint;
  v_sys uuid := '00000000-0000-4000-8000-000000000001';
begin
  select c.id into v_channel
    from chat_channel c
   where c.slug = p_channel_slug and c.is_active
   limit 1;
  if v_channel is null then return null; end if;

  insert into news_chat_post (espn_id) values (p_espn_id) on conflict do nothing;
  if not found then return null; end if;   -- already posted

  insert into chat_message (channel_id, user_id, body, image_url)
  values (v_channel, v_sys, coalesce(btrim(p_body), ''), nullif(p_image_url, ''))
  returning id into v_msg_id;
  return v_msg_id;
end; $$;

grant execute on function public.post_news_article(text, text, text, text) to authenticated, service_role;
