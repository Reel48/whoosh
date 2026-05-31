-- Lifetime aggregates by ledger kind for one user. Single round-trip.
-- Positive ledger amounts are credits; negative are debits. We sum the SIGNED
-- amount, so e.g. total_bet_stake comes out negative (money out), total_bet_payout positive.
create or replace function fn_user_lifetime_stats(p_user_id text)
returns table (
  total_purchased       bigint,
  total_premium_match   bigint,
  total_interest        bigint,
  total_transfer_in     bigint,
  total_transfer_out    bigint,
  total_bet_stake       bigint,
  total_bet_payout      bigint,
  total_invest_buy      bigint,
  total_invest_sell     bigint,
  total_adjustment      bigint,
  ledger_row_count      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(amount_cents) filter (where kind = 'purchase'),        0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'premium_match'),   0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'interest'),        0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'transfer_in'),     0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'transfer_out'),    0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'bet_stake'),       0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'bet_payout'),      0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'invest_buy'),      0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'invest_sell'),     0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'adjustment'),      0)::bigint,
    count(*)::bigint
  from wb_ledger
  where discord_user_id = p_user_id;
$$;

-- Daily end-of-day cumulative cash balance for a user over the last N days.
-- Carries forward across days with no activity by joining ledger sums to a
-- generated date series, then running a window cumulative sum.
create or replace function fn_user_balance_series(
  p_user_id text,
  p_days int
)
returns table (
  day date,
  balance_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date,
      interval '1 day'
    )::date as day
  ),
  -- Balance carried in from before the window started.
  prior as (
    select coalesce(sum(amount_cents), 0)::bigint as starting_cents
    from wb_ledger
    where discord_user_id = p_user_id
      and created_at < (current_date - (p_days - 1))::timestamptz
  ),
  daily_delta as (
    select created_at::date as day, sum(amount_cents)::bigint as delta
    from wb_ledger
    where discord_user_id = p_user_id
      and created_at >= (current_date - (p_days - 1))::timestamptz
    group by created_at::date
  )
  select
    d.day,
    (
      (select starting_cents from prior)
      + coalesce(sum(dd.delta) over (order by d.day rows between unbounded preceding and current row), 0)
    )::bigint as balance_cents
  from days d
  left join daily_delta dd on dd.day = d.day
  order by d.day;
$$;

-- Open-wager stake total (money locked up pending settlement) for a user.
create or replace function fn_user_open_wager_stake(p_user_id text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(stake_cents), 0)::bigint
  from bet_wager
  where discord_user_id = p_user_id and status = 'open';
$$;

revoke execute on function public.fn_user_lifetime_stats(text)         from anon, authenticated, public;
revoke execute on function public.fn_user_balance_series(text, int)    from anon, authenticated, public;
revoke execute on function public.fn_user_open_wager_stake(text)       from anon, authenticated, public;