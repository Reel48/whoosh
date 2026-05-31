-- Profiles: the join between Supabase Auth users and Whoosh app data.
--
-- Identity moved from "Discord user id" to the stable auth.users.id. A profile
-- row carries display info plus the optional links: a connected Discord account
-- (unlocks the Premium role perk) and a Stripe customer. `is_admin` replaces the
-- old Discord-role-based admin check.

create table profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  -- Set when a Discord account is linked (login or /account link). Unique so two
  -- profiles can't claim the same Discord identity.
  discord_user_id text unique,
  -- Set on first Stripe checkout so premium lookups don't depend on Search-API
  -- eventual consistency.
  stripe_customer_id text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup when resolving a Stripe customer / Discord id back to a user.
create index profile_discord_user_id_idx on profile (discord_user_id)
  where discord_user_id is not null;

-- ---------------------------------------------------------------------------
-- Seed a profile whenever an auth user is created. Best-effort fill of display
-- fields + Discord id from the OAuth metadata Supabase merges into
-- raw_user_meta_data. Email signups have no Discord data; Discord linking after
-- the fact is handled in app code (it doesn't re-fire this trigger).
--
-- SECURITY DEFINER so it can insert past the profile RLS below.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  derived_username text;
  derived_discord text;
begin
  derived_username := coalesce(
    nullif(meta->>'global_name', ''),
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(meta->>'user_name', ''),
    nullif(meta->>'preferred_username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'whoosh_' || left(new.id::text, 8)
  );

  -- Discord OAuth puts the snowflake in provider_id (and sub). Only trust it
  -- when this user actually signed in through Discord.
  if (new.raw_app_meta_data->>'provider' = 'discord')
     or (new.raw_app_meta_data->'providers' ? 'discord') then
    derived_discord := coalesce(nullif(meta->>'provider_id', ''), nullif(meta->>'sub', ''));
  end if;

  insert into profile (user_id, username, avatar_url, discord_user_id)
  values (
    new.id,
    derived_username,
    nullif(coalesce(meta->>'avatar_url', meta->>'picture'), ''),
    derived_discord
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep updated_at fresh.
create or replace function touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profile_set_updated_at
  before update on profile
  for each row execute function touch_profile_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: a user may READ their own profile (so client components can show their
-- handle/avatar). All WRITES go through the service-role client or the
-- definer trigger above — there is intentionally no insert/update/delete policy
-- for end users, which prevents self-granting `is_admin`.
-- ---------------------------------------------------------------------------
alter table profile enable row level security;

create policy profile_select_own
  on profile for select
  using (auth.uid() = user_id);
