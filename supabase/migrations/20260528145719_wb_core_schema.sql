-- Whoosh Bucks core schema
-- One immutable ledger is the source of truth for balances.
-- Never UPDATE a balance directly — INSERT a signed-amount ledger row.

create table wallet (
  discord_user_id text primary key,
  discord_username text not null,
  created_at timestamptz not null default now()
);

create table wb_ledger (
  id bigserial primary key,
  discord_user_id text not null references wallet(discord_user_id) on delete restrict,
  amount_cents bigint not null,
  kind text not null check (kind in (
    'purchase','premium_match','interest','transfer_in','transfer_out',
    'bet_stake','bet_payout','invest_buy','invest_sell','adjustment'
  )),
  ref_kind text,
  ref_id text,
  memo text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Idempotency: a given external event can only credit/debit once.
-- Partial unique index because most ledger rows (e.g. manual adjustments) have NULL refs.
create unique index wb_ledger_ref_unique
  on wb_ledger (ref_kind, ref_id)
  where ref_kind is not null and ref_id is not null;

create index wb_ledger_user_idx on wb_ledger (discord_user_id, created_at desc);

-- Live balance view — sum of signed ledger amounts.
create view wallet_balance as
  select discord_user_id, coalesce(sum(amount_cents), 0)::bigint as balance_cents
  from wb_ledger
  group by discord_user_id;

-- Interest rate history (one row per effective date).
create table interest_rate (
  effective_date date primary key,
  apy_bps int not null check (apy_bps >= 0 and apy_bps <= 5000),
  source text not null,
  created_at timestamptz not null default now()
);

-- Per-user daily accrual buffer; gets rolled into a single ledger row on month-end.
create table interest_accrual (
  discord_user_id text not null references wallet(discord_user_id),
  accrual_date date not null,
  amount_cents bigint not null,
  posted boolean not null default false,
  primary key (discord_user_id, accrual_date)
);

-- P2P transfer records (companion to the two ledger rows the transfer creates).
create table wb_transfer (
  id bigserial primary key,
  from_user text not null references wallet(discord_user_id),
  to_user text not null references wallet(discord_user_id),
  amount_cents bigint not null check (amount_cents > 0),
  memo text,
  created_at timestamptz not null default now()
);

-- Betting on house-run events.
create table bet_event (
  id bigserial primary key,
  title text not null,
  description text,
  status text not null check (status in ('open','locked','settled','cancelled')),
  created_by text not null references wallet(discord_user_id),
  closes_at timestamptz,
  settled_outcome_id bigint,
  created_at timestamptz not null default now()
);

create table bet_outcome (
  id bigserial primary key,
  event_id bigint not null references bet_event(id) on delete cascade,
  label text not null,
  odds_decimal numeric(10,3) not null check (odds_decimal > 1)
);

alter table bet_event
  add constraint bet_event_settled_outcome_fk
  foreign key (settled_outcome_id) references bet_outcome(id);

create table bet_wager (
  id bigserial primary key,
  event_id bigint not null references bet_event(id),
  outcome_id bigint not null references bet_outcome(id),
  discord_user_id text not null references wallet(discord_user_id),
  stake_cents bigint not null check (stake_cents > 0),
  odds_decimal_frozen numeric(10,3) not null,
  status text not null check (status in ('open','won','lost','refunded')),
  created_at timestamptz not null default now()
);

create index bet_wager_event_idx on bet_wager (event_id, status);
create index bet_wager_user_idx on bet_wager (discord_user_id, created_at desc);

-- Simulated investing.
create table invest_order (
  id bigserial primary key,
  discord_user_id text not null references wallet(discord_user_id),
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  shares numeric(20,6) not null check (shares > 0),
  price_cents bigint not null check (price_cents > 0),
  total_cents bigint not null check (total_cents > 0),
  created_at timestamptz not null default now()
);

create table invest_position (
  discord_user_id text not null references wallet(discord_user_id),
  symbol text not null,
  shares numeric(20,6) not null,
  cost_basis_cents bigint not null,
  updated_at timestamptz not null default now(),
  primary key (discord_user_id, symbol)
);

create table symbol_quote (
  symbol text primary key,
  last_price_cents bigint not null,
  fetched_at timestamptz not null
);

-- ===========================================================================
-- RLS: deny-all. Service role bypasses RLS, which is what the server uses.
-- We are NOT exposing supabase-js to the browser in v1.
-- ===========================================================================
alter table wallet            enable row level security;
alter table wb_ledger         enable row level security;
alter table interest_rate     enable row level security;
alter table interest_accrual  enable row level security;
alter table wb_transfer       enable row level security;
alter table bet_event         enable row level security;
alter table bet_outcome       enable row level security;
alter table bet_wager         enable row level security;
alter table invest_order      enable row level security;
alter table invest_position   enable row level security;
alter table symbol_quote      enable row level security;