-- Resolve subscription owners to their app identity for the admin subscriber
-- list. auth.users.email isn't reachable through PostgREST, so this SECURITY
-- DEFINER function joins profile -> auth.users and matches a profile by EITHER
-- its user_id (new subs, metadata.user_id) or its discord_user_id (legacy subs,
-- metadata.discord_user_id). Server-only, like claim_legacy_wallet.

create or replace function admin_subscriber_identities(
  p_user_ids uuid[],
  p_discord_ids text[]
)
returns table (
  user_id uuid,
  username text,
  discord_user_id text,
  email text
)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.username, p.discord_user_id, u.email::text
  from profile p
  join auth.users u on u.id = p.user_id
  where p.user_id = any(p_user_ids)
     or (p.discord_user_id is not null and p.discord_user_id = any(p_discord_ids));
$$;

revoke all on function admin_subscriber_identities(uuid[], text[]) from public, anon, authenticated;
