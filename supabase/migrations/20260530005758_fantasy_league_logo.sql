-- Per-league custom logo (overrides the Sleeper avatar in the app).
alter table public.fantasy_league add column if not exists logo_url text;

-- Public bucket to hold uploaded league logos. Public read; service role writes
-- (matches src/lib/supabase.ts). Idempotent.
insert into storage.buckets (id, name, public)
values ('fantasy-logos', 'fantasy-logos', true)
on conflict (id) do nothing;