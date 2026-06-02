-- Store the previous-close price alongside each cached quote so the dashboard
-- can compute a day-over-day market move on holdings (Finnhub's /quote already
-- returns `pc`). Nullable + backfilled lazily: existing rows refresh on their
-- next fetch, and the dashboard treats null as "no day-change data yet".
alter table symbol_quote
  add column if not exists prev_close_cents bigint;
