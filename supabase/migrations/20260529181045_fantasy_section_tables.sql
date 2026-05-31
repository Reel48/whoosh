-- Fantasy section (Sleeper-powered). Service-role only: RLS on, no policies.

-- Curated Whoosh-run leagues (admin-managed).
create table if not exists public.fantasy_league (
  sleeper_league_id text primary key,
  season            text not null,
  name              text,                       -- display override; null falls back to Sleeper
  sort              int  not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
alter table public.fantasy_league enable row level security;

-- Cached Sleeper player index (refreshed daily by cron).
create table if not exists public.sleeper_player (
  player_id  text primary key,
  full_name  text,
  position   text,
  team       text,
  status     text,
  updated_at timestamptz not null default now()
);
alter table public.sleeper_player enable row level security;
create index if not exists sleeper_player_full_name_idx on public.sleeper_player (lower(full_name));

-- Member ↔ Sleeper account link (highlights their roster).
create table if not exists public.fantasy_link (
  discord_user_id  text primary key,
  sleeper_user_id  text not null,
  sleeper_username text not null,
  linked_at        timestamptz not null default now()
);
alter table public.fantasy_link enable row level security;

-- Maps a Sleeper weekly matchup to an auto-created WB wager event so we can
-- dedupe creation and settle by comparing final points to the two outcomes.
create table if not exists public.fantasy_matchup_event (
  id                bigint generated always as identity primary key,
  sleeper_league_id text not null,
  season            text not null,
  week              int  not null,
  matchup_id        int  not null,
  event_id          bigint not null references public.bet_event(id) on delete cascade,
  home_roster_id    int not null,
  away_roster_id    int not null,
  home_outcome_id   bigint not null references public.bet_outcome(id),
  away_outcome_id   bigint not null references public.bet_outcome(id),
  settled           boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (sleeper_league_id, season, week, matchup_id)
);
alter table public.fantasy_matchup_event enable row level security;
create index if not exists fantasy_matchup_event_lookup_idx
  on public.fantasy_matchup_event (sleeper_league_id, season, week);