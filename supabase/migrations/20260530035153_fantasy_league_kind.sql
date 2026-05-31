-- League game type: standard H2H fantasy, or a Sleeper pick'em pool.
alter table public.fantasy_league
  add column if not exists kind text not null default 'standard';
alter table public.fantasy_league
  drop constraint if exists fantasy_league_kind_chk;
alter table public.fantasy_league
  add constraint fantasy_league_kind_chk check (kind in ('standard', 'pickem', 'survivor'));