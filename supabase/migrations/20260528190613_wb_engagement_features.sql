
-- Add new ledger kinds for daily bonus and referrals
alter table public.wb_ledger drop constraint if exists wb_ledger_kind_check;
alter table public.wb_ledger
  add constraint wb_ledger_kind_check
  check (kind = any (array[
    'purchase','premium_match','interest',
    'transfer_in','transfer_out',
    'bet_stake','bet_payout',
    'invest_buy','invest_sell','invest_dividend',
    'daily_bonus','referral_reward',
    'adjustment'
  ]));

-- Notifications: append-only feed per user
create table if not exists public.notification (
  id bigserial primary key,
  discord_user_id text not null references public.wallet(discord_user_id) on delete cascade,
  kind text not null check (kind in (
    'bet_settled','dividend','transfer_in','interest_posted',
    'achievement','renewal','referral','system'
  )),
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists notification_user_unread_idx
  on public.notification (discord_user_id, created_at desc)
  where read_at is null;
create index if not exists notification_user_recent_idx
  on public.notification (discord_user_id, created_at desc);
alter table public.notification enable row level security;

-- Watchlist
create table if not exists public.user_watchlist (
  discord_user_id text not null references public.wallet(discord_user_id) on delete cascade,
  symbol text not null,
  added_at timestamptz not null default now(),
  primary key (discord_user_id, symbol)
);
alter table public.user_watchlist enable row level security;

-- Achievements (one row per (user, code))
create table if not exists public.user_achievement (
  discord_user_id text not null references public.wallet(discord_user_id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (discord_user_id, code)
);
alter table public.user_achievement enable row level security;

-- Referrals: each user has a stable invite code; redemptions track who used whose code
create table if not exists public.referral_code (
  discord_user_id text primary key references public.wallet(discord_user_id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_code enable row level security;

create table if not exists public.referral_use (
  id bigserial primary key,
  referrer_user_id text not null references public.wallet(discord_user_id) on delete cascade,
  referred_user_id text not null references public.wallet(discord_user_id) on delete cascade,
  code text not null,
  rewarded boolean not null default false,
  rewarded_at timestamptz,
  reward_amount_cents bigint,
  created_at timestamptz not null default now(),
  unique (referred_user_id) -- a user can be referred only once
);
create index if not exists referral_use_referrer_idx
  on public.referral_use (referrer_user_id);
alter table public.referral_use enable row level security;

-- Daily check-in: one row per (user, day) so consecutive days = streak
create table if not exists public.user_daily_bonus (
  discord_user_id text not null references public.wallet(discord_user_id) on delete cascade,
  claim_date date not null,
  amount_cents bigint not null,
  streak_day int not null,
  created_at timestamptz not null default now(),
  primary key (discord_user_id, claim_date)
);
alter table public.user_daily_bonus enable row level security;

-- RPC: claim today's daily bonus. Returns (claimed boolean, amount_cents bigint, streak int).
-- Idempotent — calling twice on the same UTC day is a no-op that returns the existing row.
create or replace function public.fn_claim_daily_bonus(
  p_user_id text
)
returns table (claimed boolean, amount_cents bigint, streak int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := v_today - interval '1 day';
  v_prev_streak int;
  v_streak int;
  v_amount bigint;
  v_existing record;
begin
  -- If already claimed today, return existing row (idempotent).
  select * into v_existing
    from public.user_daily_bonus
   where discord_user_id = p_user_id and claim_date = v_today;
  if found then
    return query select false, v_existing.amount_cents, v_existing.streak_day;
    return;
  end if;

  -- Look up yesterday's streak to decide if we continue or reset.
  select streak_day into v_prev_streak
    from public.user_daily_bonus
   where discord_user_id = p_user_id and claim_date = v_yesterday;
  v_streak := coalesce(v_prev_streak, 0) + 1;

  -- Reward curve: $0.25 base, +$0.10 per streak day capped at $2.50.
  v_amount := least(25 + 10 * (v_streak - 1), 250);

  insert into public.user_daily_bonus (discord_user_id, claim_date, amount_cents, streak_day)
  values (p_user_id, v_today, v_amount, v_streak);

  perform public.fn_credit_ledger(
    p_user_id,
    v_amount,
    'daily_bonus',
    'daily_bonus',
    to_char(v_today, 'YYYY-MM-DD'),
    'Daily check-in (' || v_streak || '-day streak)',
    jsonb_build_object('streak_day', v_streak, 'claim_date', v_today)
  );

  return query select true, v_amount, v_streak;
end;
$$;
revoke all on function public.fn_claim_daily_bonus(text) from public;

-- Read view: a user's current streak (today's, else 0).
create or replace function public.fn_user_streak(p_user_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select streak_day
       from public.user_daily_bonus
      where discord_user_id = p_user_id
        and claim_date >= (now() at time zone 'utc')::date - interval '1 day'
      order by claim_date desc
      limit 1),
    0
  );
$$;
revoke all on function public.fn_user_streak(text) from public;

-- Leaderboard: top streaks
create or replace function public.fn_wb_leaderboard_streaks(p_limit int default 10)
returns table (
  rank int,
  discord_user_id text,
  discord_username text,
  streak_day int
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select udb.discord_user_id,
           udb.streak_day,
           udb.claim_date
      from public.user_daily_bonus udb
      join (
        select discord_user_id, max(claim_date) as max_date
          from public.user_daily_bonus
         group by discord_user_id
      ) m on m.discord_user_id = udb.discord_user_id and m.max_date = udb.claim_date
     where udb.claim_date >= (now() at time zone 'utc')::date - interval '1 day'
  )
  select (row_number() over (order by l.streak_day desc, l.claim_date desc))::int as rank,
         l.discord_user_id,
         w.discord_username,
         l.streak_day
    from latest l
    join public.wallet w on w.discord_user_id = l.discord_user_id
   order by l.streak_day desc, l.claim_date desc
   limit greatest(p_limit, 1);
$$;
revoke all on function public.fn_wb_leaderboard_streaks(int) from public;

-- Leaderboard: biggest single payouts this week
create or replace function public.fn_wb_leaderboard_biggest_wins(
  p_limit int default 10,
  p_days int default 7
)
returns table (
  rank int,
  discord_user_id text,
  discord_username text,
  payout_cents bigint,
  created_at timestamptz,
  memo text
)
language sql
stable
security definer
set search_path = public
as $$
  with recent_wins as (
    select wl.discord_user_id, wl.amount_cents, wl.created_at, wl.memo
      from public.wb_ledger wl
     where wl.kind = 'bet_payout'
       and wl.amount_cents > 0
       and wl.created_at >= now() - (p_days || ' days')::interval
  )
  select (row_number() over (order by rw.amount_cents desc))::int as rank,
         rw.discord_user_id,
         w.discord_username,
         rw.amount_cents as payout_cents,
         rw.created_at,
         rw.memo
    from recent_wins rw
    join public.wallet w on w.discord_user_id = rw.discord_user_id
   order by rw.amount_cents desc, rw.created_at desc
   limit greatest(p_limit, 1);
$$;
revoke all on function public.fn_wb_leaderboard_biggest_wins(int, int) from public;

-- Leaderboard: top realized invest P/L this week
-- Computed as sum of (invest_sell + invest_buy) over the window. invest_buy is
-- recorded as negative in the ledger, so this is net realized cash flow from
-- trades — i.e. realized P/L if the user closed positions.
create or replace function public.fn_wb_leaderboard_traders(
  p_limit int default 10,
  p_days int default 7
)
returns table (
  rank int,
  discord_user_id text,
  discord_username text,
  realized_pl_cents bigint,
  trades int
)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select wl.discord_user_id,
           sum(wl.amount_cents) filter (where wl.kind in ('invest_sell','invest_buy')) as pl,
           count(*) filter (where wl.kind in ('invest_sell','invest_buy')) as trades
      from public.wb_ledger wl
     where wl.created_at >= now() - (p_days || ' days')::interval
     group by wl.discord_user_id
  )
  select (row_number() over (order by r.pl desc nulls last))::int as rank,
         r.discord_user_id,
         w.discord_username,
         coalesce(r.pl, 0) as realized_pl_cents,
         coalesce(r.trades, 0)::int as trades
    from recent r
    join public.wallet w on w.discord_user_id = r.discord_user_id
   where r.trades > 0
   order by r.pl desc nulls last
   limit greatest(p_limit, 1);
$$;
revoke all on function public.fn_wb_leaderboard_traders(int, int) from public;

-- Total WB outstanding — sum of all wallet balances. Admin metric.
create or replace function public.fn_wb_total_supply()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::bigint
    from public.wb_ledger;
$$;
revoke all on function public.fn_wb_total_supply() from public;

-- Daily active users — distinct users who had any ledger activity in the last 24h
create or replace function public.fn_wb_dau(p_days int default 1)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct discord_user_id)::int
    from public.wb_ledger
   where created_at >= now() - (p_days || ' days')::interval;
$$;
revoke all on function public.fn_wb_dau(int) from public;

-- Total WB supply time series (sum of ledger amounts ending each day, last p_days days).
create or replace function public.fn_wb_supply_series(p_days int default 90)
returns table (day date, supply_cents bigint)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select (now() at time zone 'utc')::date - d as day
      from generate_series(0, greatest(p_days, 1) - 1) as d
  ),
  cum as (
    select d.day,
           coalesce(
             (select sum(amount_cents)
                from public.wb_ledger
               where created_at <= (d.day + interval '1 day')
            ), 0
           )::bigint as supply_cents
      from days d
  )
  select day, supply_cents from cum order by day asc;
$$;
revoke all on function public.fn_wb_supply_series(int) from public;
