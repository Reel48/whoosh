-- In-app chat (Discord-style): Categories → Channels, multi-Role users, XP/Levels.
--
-- Mirrors the house style: tables are RLS-on with WRITES via SECURITY DEFINER
-- RPCs / the service-role client only. The ONE deliberate addition vs the rest
-- of the schema is SELECT policies — Supabase Realtime authorizes a subscriber's
-- postgres_changes stream against SELECT RLS using their JWT, so the iOS client
-- can receive only the messages it's allowed to read. History reads still go
-- through api/v1 (enriched); Realtime just streams raw new rows.

-- ── Roles ────────────────────────────────────────────────────────────────────
create table if not exists public.chat_role (
  id          bigint generated always as identity primary key,
  key         text not null unique,                 -- 'member' | 'premium' | 'admin' | custom
  name        text not null,
  color       text not null default '#9aa0a6',       -- hex, used to tint the display name
  priority    integer not null default 0,            -- highest-priority held role wins for color
  is_system   boolean not null default false,        -- member/premium/admin are auto-reconciled
  assignable  boolean not null default true,         -- admins may grant/revoke when true
  created_at  timestamptz not null default now()
);

create table if not exists public.chat_user_role (
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     bigint not null references public.chat_role(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index if not exists chat_user_role_role_idx on public.chat_user_role (role_id);

-- ── Categories & channels ──────────────────────────────────────────────────
create table if not exists public.chat_category (
  id         bigint generated always as identity primary key,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_channel (
  id               bigint generated always as identity primary key,
  category_id      bigint not null references public.chat_category(id) on delete cascade,
  slug             text not null unique,
  name             text not null,
  description      text,
  position         integer not null default 0,
  kind             text not null default 'text'
                   check (kind in ('text','media','leaderboard','starboard')),
  post_policy      text not null default 'members'
                   check (post_policy in ('members','admins','system')),
  required_role_id bigint references public.chat_role(id),  -- null = open to all members
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists chat_channel_category_idx on public.chat_channel (category_id, position);

-- ── Messages, reactions, mentions ────────────────────────────────────────────
create table if not exists public.chat_message (
  id          bigint generated always as identity primary key,
  channel_id  bigint not null references public.chat_channel(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null default '',
  image_url   text,
  reply_to_id bigint references public.chat_message(id) on delete set null,
  star_count  integer not null default 0,            -- denormalized ⭐ count
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);
create index if not exists chat_message_channel_idx on public.chat_message (channel_id, id desc);
create index if not exists chat_message_star_idx on public.chat_message (star_count desc) where star_count > 0;
alter table public.chat_message replica identity full;

create table if not exists public.chat_reaction (
  message_id bigint not null references public.chat_message(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  channel_id bigint not null references public.chat_channel(id) on delete cascade, -- denorm for realtime filter
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists chat_reaction_channel_idx on public.chat_reaction (channel_id);
alter table public.chat_reaction replica identity full;

create table if not exists public.chat_mention (
  message_id        bigint not null references public.chat_message(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);
create index if not exists chat_mention_user_idx on public.chat_mention (mentioned_user_id);

-- ── XP / levels ──────────────────────────────────────────────────────────────
create table if not exists public.chat_user_stat (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  xp            bigint not null default 0,
  message_count bigint not null default 0,
  level         integer not null default 0,
  last_xp_at    timestamptz,
  updated_at    timestamptz not null default now()
);
create index if not exists chat_user_stat_xp_idx on public.chat_user_stat (xp desc);

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- True iff the user may read the channel: open channel, holds the required role,
-- or is an admin (profile.is_admin). SECURITY DEFINER so it can read past RLS;
-- used by both the SELECT policies and the write RPCs.
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
begin
  if p_user is null then return false; end if;
  select required_role_id, is_active into v_required, v_active
    from chat_channel where id = p_channel;
  if not found or not v_active then return false; end if;
  if v_required is null then return true; end if;
  if exists (select 1 from profile where user_id = p_user and is_admin) then return true; end if;
  return exists (select 1 from chat_user_role
                  where user_id = p_user and role_id = v_required);
end;
$$;

-- MEE6-style cumulative curve: xp to *finish* level i is 5*i^2 + 50*i + 100.
create or replace function public.chat_level_for_xp(p_xp bigint)
returns integer
language plpgsql
immutable
as $$
declare
  v_level integer := 0;
  v_remaining bigint := greatest(p_xp, 0);
  v_need bigint;
begin
  loop
    v_need := 5 * v_level * v_level + 50 * v_level + 100;
    exit when v_remaining < v_need;
    v_remaining := v_remaining - v_need;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- ── RPCs (writes) ────────────────────────────────────────────────────────────
-- Send a message: enforce access + post policy, insert, parse @mentions, and
-- bump XP/level (XP at most once per 60s to blunt spam). Returns the new row +
-- whether the author leveled up.
create or replace function public.send_chat_message(
  p_user uuid,
  p_channel bigint,
  p_body text,
  p_image_url text,
  p_reply_to bigint
) returns table (id bigint, created_at timestamptz, level integer, leveled_up boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy   text;
  v_is_admin boolean;
  v_msg_id   bigint;
  v_created  timestamptz;
  v_handle   text;
  v_old_level integer;
  v_new_level integer;
  v_grant    integer := 0;
  v_now      timestamptz := now();
begin
  if coalesce(nullif(btrim(p_body), ''), p_image_url) is null then
    raise exception 'empty message';
  end if;
  if not chat_can_read(p_channel, p_user) then
    raise exception 'forbidden';
  end if;

  select post_policy into v_policy from chat_channel where id = p_channel;
  select coalesce((select is_admin from profile where user_id = p_user), false) into v_is_admin;
  if v_policy = 'system' then raise exception 'forbidden';
  elsif v_policy = 'admins' and not v_is_admin then raise exception 'forbidden';
  end if;

  insert into chat_message (channel_id, user_id, body, image_url, reply_to_id)
  values (p_channel, p_user, coalesce(btrim(p_body), ''), nullif(p_image_url, ''), p_reply_to)
  returning chat_message.id, chat_message.created_at into v_msg_id, v_created;

  -- @mentions → resolve handles to users (case-insensitive), one row each.
  for v_handle in
    select distinct lower(m[1]) from regexp_matches(coalesce(p_body, ''), '@([A-Za-z0-9_]{3,20})', 'g') as m
  loop
    insert into chat_mention (message_id, mentioned_user_id)
    select v_msg_id, p.user_id from profile p where lower(p.username) = v_handle
    on conflict do nothing;
  end loop;

  -- XP + level (anti-spam: only earn once per 60s; message_count always rises).
  insert into chat_user_stat (user_id, xp, message_count, level, last_xp_at, updated_at)
  values (p_user, 0, 0, 0, null, v_now)
  on conflict (user_id) do nothing;

  select level into v_old_level from chat_user_stat where user_id = p_user;
  select case when last_xp_at is null or last_xp_at < v_now - interval '60 seconds'
              then 15 else 0 end
    into v_grant from chat_user_stat where user_id = p_user;

  update chat_user_stat
     set message_count = message_count + 1,
         xp            = xp + v_grant,
         last_xp_at    = case when v_grant > 0 then v_now else last_xp_at end,
         level         = chat_level_for_xp(xp + v_grant),
         updated_at    = v_now
   where user_id = p_user
   returning level into v_new_level;

  return query select v_msg_id, v_created, v_new_level, (v_new_level > v_old_level);
end;
$$;

-- Toggle a reaction; recompute ⭐ count. Returns the new count for the emoji.
create or replace function public.toggle_chat_reaction(
  p_user uuid,
  p_message bigint,
  p_emoji text,
  p_on boolean
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel bigint;
  v_count   integer;
begin
  select channel_id into v_channel from chat_message where id = p_message and deleted_at is null;
  if not found or not chat_can_read(v_channel, p_user) then raise exception 'forbidden'; end if;

  if p_on then
    insert into chat_reaction (message_id, user_id, emoji, channel_id)
    values (p_message, p_user, p_emoji, v_channel) on conflict do nothing;
  else
    delete from chat_reaction where message_id = p_message and user_id = p_user and emoji = p_emoji;
  end if;

  update chat_message
     set star_count = (select count(*) from chat_reaction where message_id = p_message and emoji = '⭐')
   where id = p_message
   returning star_count into v_count;
  return v_count;
end;
$$;

create or replace function public.edit_chat_message(p_user uuid, p_message bigint, p_body text)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare v_edited timestamptz;
begin
  update chat_message set body = btrim(p_body), edited_at = now()
   where id = p_message and user_id = p_user and deleted_at is null
   returning edited_at into v_edited;
  if not found then raise exception 'forbidden'; end if;
  return v_edited;
end;
$$;

create or replace function public.delete_chat_message(p_user uuid, p_message bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_is_admin boolean;
begin
  select coalesce((select is_admin from profile where user_id = p_user), false) into v_is_admin;
  update chat_message set deleted_at = now()
   where id = p_message and deleted_at is null and (user_id = p_user or v_is_admin);
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- Admin role management (custom assignable roles).
create or replace function public.assign_chat_role(p_actor uuid, p_target uuid, p_role bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from profile where user_id = p_actor and is_admin) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from chat_role where id = p_role and assignable) then
    raise exception 'role not assignable';
  end if;
  insert into chat_user_role (user_id, role_id, assigned_by)
  values (p_target, p_role, p_actor) on conflict do nothing;
end;
$$;

create or replace function public.remove_chat_role(p_actor uuid, p_target uuid, p_role bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from profile where user_id = p_actor and is_admin) then
    raise exception 'forbidden';
  end if;
  delete from chat_user_role using chat_role r
   where chat_user_role.role_id = r.id and r.assignable
     and chat_user_role.user_id = p_target and chat_user_role.role_id = p_role;
end;
$$;

-- Keep the system roles (member always; premium/admin from the caller's known
-- state) in sync for a user. Called from the api on access.
create or replace function public.reconcile_chat_roles(p_user uuid, p_is_premium boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_member bigint; v_premium bigint; v_admin bigint; v_is_admin boolean;
begin
  select id into v_member  from chat_role where key = 'member';
  select id into v_premium from chat_role where key = 'premium';
  select id into v_admin   from chat_role where key = 'admin';
  select coalesce((select is_admin from profile where user_id = p_user), false) into v_is_admin;

  insert into chat_user_role (user_id, role_id) values (p_user, v_member) on conflict do nothing;

  if p_is_premium then
    insert into chat_user_role (user_id, role_id) values (p_user, v_premium) on conflict do nothing;
  else
    delete from chat_user_role where user_id = p_user and role_id = v_premium;
  end if;

  if v_is_admin then
    insert into chat_user_role (user_id, role_id) values (p_user, v_admin) on conflict do nothing;
  else
    delete from chat_user_role where user_id = p_user and role_id = v_admin;
  end if;
end;
$$;

-- ── RLS: read-only policies (writes are RPC/service-role only) ────────────────
alter table public.chat_role       enable row level security;
alter table public.chat_user_role  enable row level security;
alter table public.chat_category   enable row level security;
alter table public.chat_channel    enable row level security;
alter table public.chat_message    enable row level security;
alter table public.chat_reaction   enable row level security;
alter table public.chat_mention    enable row level security;
alter table public.chat_user_stat  enable row level security;

create policy chat_role_read       on public.chat_role       for select to authenticated using (true);
create policy chat_user_role_read  on public.chat_user_role  for select to authenticated using (true);
create policy chat_category_read   on public.chat_category   for select to authenticated using (true);
create policy chat_channel_read    on public.chat_channel    for select to authenticated using (public.chat_can_read(id, auth.uid()));
create policy chat_stat_read       on public.chat_user_stat  for select to authenticated using (true);
create policy chat_mention_read    on public.chat_mention    for select to authenticated using (mentioned_user_id = auth.uid());
create policy chat_message_read    on public.chat_message    for select to authenticated using (public.chat_can_read(channel_id, auth.uid()));
create policy chat_reaction_read   on public.chat_reaction   for select to authenticated using (public.chat_can_read(channel_id, auth.uid()));

-- Realtime streams new messages + reactions to authorized subscribers.
alter publication supabase_realtime add table public.chat_message;
alter publication supabase_realtime add table public.chat_reaction;

-- ── Seed: system roles, categories, channels ─────────────────────────────────
insert into public.chat_role (key, name, color, priority, is_system, assignable) values
  ('member',  'Member',  '#9aa0a6', 0,  true, false),
  ('premium', 'Premium', '#cef932', 50, true, false),
  ('admin',   'Admin',   '#ff5577', 100,true, false)
on conflict (key) do nothing;

do $$
declare
  c_info bigint; c_general bigint; c_sports bigint; c_media bigint;
  c_misc bigint; c_premium bigint; c_admin bigint;
  r_premium bigint; r_admin bigint;
begin
  select id into r_premium from chat_role where key = 'premium';
  select id into r_admin   from chat_role where key = 'admin';

  insert into chat_category (name, position) values ('Important Information', 0) returning id into c_info;
  insert into chat_category (name, position) values ('General', 1)               returning id into c_general;
  insert into chat_category (name, position) values ('Sports', 2)                returning id into c_sports;
  insert into chat_category (name, position) values ('Media', 3)                 returning id into c_media;
  insert into chat_category (name, position) values ('Miscellaneous', 4)         returning id into c_misc;
  insert into chat_category (name, position) values ('Whoosh Premium', 5)        returning id into c_premium;
  insert into chat_category (name, position) values ('Admin Only', 6)            returning id into c_admin;

  insert into chat_channel (category_id, slug, name, position, kind, post_policy, required_role_id) values
    (c_info, 'welcome', 'Welcome', 0, 'text', 'admins', null),
    (c_info, 'whoosh-philanthropy', 'Whoosh Philanthropy', 1, 'text', 'admins', null),
    (c_info, 'xp-leaderboard', 'XP Leaderboard', 2, 'leaderboard', 'system', null),
    (c_info, 'starboard', 'Starboard', 3, 'starboard', 'system', null),

    (c_general, 'general', 'General', 0, 'text', 'members', null),
    (c_general, 'announcements', 'Announcements', 1, 'text', 'admins', null),

    (c_sports, 'nfl-football', 'NFL Football', 0, 'text', 'members', null),
    (c_sports, 'college-football', 'College Football', 1, 'text', 'members', null),
    (c_sports, 'baseball', 'Baseball', 2, 'text', 'members', null),
    (c_sports, 'soccer', 'Soccer', 3, 'text', 'members', null),
    (c_sports, 'basketball', 'Basketball', 4, 'text', 'members', null),
    (c_sports, 'golf', 'Golf', 5, 'text', 'members', null),
    (c_sports, 'fights', 'Fights', 6, 'text', 'members', null),
    (c_sports, 'tennis', 'Tennis', 7, 'text', 'members', null),

    (c_media, 'pic-of-the-day', 'Pic of the Day', 0, 'media', 'members', null),
    (c_media, 'movies-tv', 'Movies & TV', 1, 'text', 'members', null),
    (c_media, 'music', 'Music', 2, 'text', 'members', null),
    (c_media, 'gaming', 'Gaming', 3, 'text', 'members', null),
    (c_media, 'youtube-videos', 'Youtube Videos', 4, 'text', 'members', null),

    (c_misc, 'health-fitness', 'Health & Fitness', 0, 'text', 'members', null),
    (c_misc, 'food-drinks', 'Food & Drinks', 1, 'text', 'members', null),
    (c_misc, 'money-rankings', 'Money Rankings', 2, 'text', 'members', null),

    (c_premium, 'premium', 'Premium', 0, 'text', 'members', r_premium),
    (c_premium, 'sports-betting', 'Sports Betting', 1, 'text', 'members', r_premium),
    (c_premium, 'business', 'Business', 2, 'text', 'members', r_premium),
    (c_premium, 'politics', 'Politics', 3, 'text', 'members', r_premium),

    (c_admin, 'admin-chat', 'Admin Chat', 0, 'text', 'members', r_admin),
    (c_admin, 'payments', 'Payments', 1, 'text', 'members', r_admin),
    (c_admin, 'security', 'Security', 2, 'text', 'members', r_admin);
end $$;
