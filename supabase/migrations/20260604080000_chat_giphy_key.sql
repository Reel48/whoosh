-- Giphy API key access for the chat GIF picker. The key itself lives in Supabase
-- Vault (set out-of-band via vault.create_secret, name 'GIPHY_API_KEY') — never
-- in the repo. This SECURITY DEFINER function returns it, restricted to the
-- service_role (the Next.js backend's client) so it can't be read by app users.
-- Returns null if the secret isn't set, in which case GIF search is disabled.
create or replace function public.get_giphy_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'GIPHY_API_KEY' limit 1
$$;

revoke all on function public.get_giphy_key() from public, anon, authenticated;
grant execute on function public.get_giphy_key() to service_role;
