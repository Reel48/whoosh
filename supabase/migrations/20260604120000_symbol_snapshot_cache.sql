-- Durable cache for TwelveData price snapshots (chart candles + key stats),
-- keyed by (symbol, range). Mirrors the symbol_quote cache: the server reads a
-- fresh row to avoid hitting TwelveData, write-throughs on a successful fetch,
-- and falls back to a STALE row when TwelveData rate-limits (free tier is only
-- 8 credits/min). This keeps the invest detail page from going blank.
create table symbol_snapshot (
  symbol     text not null,
  range      text not null,
  data       jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (symbol, range)
);

-- RLS: deny-all, same as the rest of the wb cache tables. The server uses the
-- service role (which bypasses RLS); supabase-js is never exposed to clients.
alter table symbol_snapshot enable row level security;
