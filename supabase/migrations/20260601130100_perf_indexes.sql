-- Performance cleanup flagged by Supabase advisors.
--
-- Plain (non-CONCURRENT) CREATE INDEX because Supabase runs each migration in a
-- transaction and these tables are small/young — the brief lock is harmless.

-- Covering indexes for unindexed foreign keys ---------------------------------
-- Without these, FK lookups and cascade checks fall back to sequential scans.
create index if not exists bet_event_created_by_idx           on public.bet_event (created_by);
create index if not exists bet_event_settled_outcome_id_idx   on public.bet_event (settled_outcome_id);
create index if not exists bet_wager_outcome_id_idx           on public.bet_wager (outcome_id);
create index if not exists fantasy_matchup_event_away_outcome_id_idx on public.fantasy_matchup_event (away_outcome_id);
create index if not exists fantasy_matchup_event_home_outcome_id_idx on public.fantasy_matchup_event (home_outcome_id);
create index if not exists fantasy_matchup_event_event_id_idx on public.fantasy_matchup_event (event_id);
create index if not exists invest_order_discord_user_id_idx   on public.invest_order (discord_user_id);
create index if not exists wb_transfer_from_user_idx          on public.wb_transfer (from_user);
create index if not exists wb_transfer_to_user_idx            on public.wb_transfer (to_user);

-- RLS initplan fix -------------------------------------------------------------
-- Wrap auth.uid() in a scalar subselect so Postgres evaluates it once per query
-- instead of once per row (auth_rls_initplan advisor). Same semantics.
alter policy profile_select_own on public.profile
  using ((select auth.uid()) = user_id);

-- Drop redundant index ---------------------------------------------------------
-- profile.discord_user_id is declared UNIQUE, which already creates an index on
-- the column; this partial index duplicates it and has never been scanned. The
-- app only ever reads profile by its user_id PK, never by discord_user_id.
drop index if exists public.profile_discord_user_id_idx;
