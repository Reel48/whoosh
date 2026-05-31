-- Synced (odds_api) events have no human author; allow null created_by.
alter table public.bet_event alter column created_by drop not null;