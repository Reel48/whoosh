-- First-run onboarding for the iOS app.
--
-- Profiles are auto-seeded by `handle_new_user` with a *derived* username, so
-- there's no signal for "has this user actually set up their profile?". The
-- iOS app needs that to decide between showing onboarding (pick a unique
-- @handle + avatar) and going straight to the logged-in home.

-- Null = not yet onboarded. New signups get null (the seed trigger is unchanged);
-- the iOS app forces onboarding when null. The web app ignores this flag.
alter table public.profile add column if not exists onboarded_at timestamptz;

-- Existing users have real handles and have used the web app — treat them as
-- already onboarded so they're never forced through the app's first-run flow.
update public.profile set onboarded_at = created_at where onboarded_at is null;

-- Public bucket for uploaded profile avatars. Public read; service-role writes
-- (matches src/lib/supabase.ts). Mirrors the `fantasy-logos` bucket. Idempotent.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
