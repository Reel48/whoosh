-- Anonymous pool buy-ins from the standalone /join landing page.
--
-- Unlike `fantasy_entitlement` (keyed to a Whoosh account, seats the buyer in
-- one of several interchangeable leagues), a pool entry has no account behind
-- it: the buyer pays with an email only and is handed the Sleeper invite link.
-- Pick 'Em / Survivor have effectively unlimited capacity, so there is no
-- seating to do — this table is purely the record of who paid for what.
create table if not exists public.pool_entry_purchase (
  id uuid primary key default gen_random_uuid(),
  email text,
  /** Offer purchased: a single group key ("pickem"/"survivor") or "both". */
  offer text not null,
  /** Every fantasy_league.group_key this purchase covers. */
  group_keys text[] not null,
  season text not null,
  amount_cents integer not null default 0,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index if not exists pool_entry_purchase_email
  on public.pool_entry_purchase (lower(email));
create index if not exists pool_entry_purchase_created
  on public.pool_entry_purchase (created_at desc);

-- Service-role only, like every other table here (RLS on, no policies).
alter table public.pool_entry_purchase enable row level security;
