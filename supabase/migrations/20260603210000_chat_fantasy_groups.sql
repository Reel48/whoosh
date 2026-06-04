-- Per-league / per-pool group chat, gated to actual league members.
--
-- A league/pool chat is a `chat_channel` with kind='group' and no category; its
-- members live in `chat_channel_member` (same machinery as DMs), so RLS gates
-- reads, posts, and the Realtime stream automatically. Membership is decided in
-- the app layer (a user is "in" a league when their linked Sleeper account is a
-- roster owner, or they hold a paid entitlement — which needs the Sleeper API),
-- then synced here on chat-open.

-- 'group' is a member-gated channel kind, like 'dm'.
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
   where conrelid = 'public.chat_channel'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind%' limit 1;
  if v_name is not null then
    execute format('alter table public.chat_channel drop constraint %I', v_name);
  end if;
end $$;
alter table public.chat_channel add constraint chat_channel_kind_check
  check (kind in ('text','media','leaderboard','starboard','dm','group'));

-- Member-gate both 'dm' and 'group' via chat_channel_member.
create or replace function public.chat_can_read(p_channel bigint, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_required bigint;
  v_active   boolean;
  v_kind     text;
begin
  if p_user is null then return false; end if;
  select required_role_id, is_active, kind into v_required, v_active, v_kind
    from chat_channel where id = p_channel;
  if not found or not v_active then return false; end if;
  if v_kind in ('dm', 'group') then
    return exists (select 1 from chat_channel_member where channel_id = p_channel and user_id = p_user);
  end if;
  if v_required is null then return true; end if;
  if exists (select 1 from profile where user_id = p_user and is_admin) then return true; end if;
  return exists (select 1 from chat_user_role where user_id = p_user and role_id = v_required);
end;
$$;

-- Get/create a fantasy league|pool channel (slug = 'fantasy:<sleeper_league_id>')
-- and add the (already membership-verified) user. App layer verifies membership
-- before calling — this just ensures the channel + seats the member.
create or replace function public.ensure_fantasy_chat_channel(p_league_id text, p_name text, p_user uuid)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_slug text := 'fantasy:' || p_league_id; v_id bigint;
begin
  select id into v_id from chat_channel where slug = v_slug;
  if v_id is null then
    insert into chat_channel (category_id, slug, name, kind, post_policy, required_role_id)
    values (null, v_slug, p_name, 'group', 'members', null)
    on conflict (slug) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from chat_channel where slug = v_slug; end if;
  end if;
  insert into chat_channel_member (channel_id, user_id) values (v_id, p_user) on conflict do nothing;
  return v_id;
end;
$$;

-- Remove a user from a fantasy channel (when they're no longer a member).
create or replace function public.remove_fantasy_chat_member(p_league_id text, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from chat_channel_member m using chat_channel c
   where m.channel_id = c.id and c.slug = 'fantasy:' || p_league_id and m.user_id = p_user;
end;
$$;
