-- ===========================================================================
-- 1. REBASE: 1 WB = $1 USD  →  10 WB = $1 USD. Multiply all WB-denominated
--    state by 10 so existing holders remain proportionally whole.
-- ===========================================================================
update wb_ledger        set amount_cents     = amount_cents     * 10;
update invest_position  set cost_basis_cents = cost_basis_cents * 10;
update bet_wager        set stake_cents      = stake_cents      * 10;
update interest_accrual set amount_cents     = amount_cents     * 10;

-- ===========================================================================
-- 2. ADD 'invest_dividend' ledger kind.
-- ===========================================================================
alter table wb_ledger drop constraint wb_ledger_kind_check;
alter table wb_ledger add constraint wb_ledger_kind_check check (kind in (
  'purchase','premium_match','interest','transfer_in','transfer_out',
  'bet_stake','bet_payout','invest_buy','invest_sell','invest_dividend',
  'adjustment'
));

-- ===========================================================================
-- 3. Update invest_buy/sell: real-USD price × 10 = WB cents.
-- ===========================================================================
create or replace function fn_invest_buy(
  p_user_id text, p_symbol text, p_shares numeric(20,6), p_price_cents bigint
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_total_cents bigint;
  v_balance bigint;
  v_existing_shares numeric(20,6);
  v_existing_basis bigint;
  v_order_id bigint;
begin
  if p_shares <= 0 then raise exception 'shares must be positive'; end if;
  if p_price_cents <= 0 then raise exception 'price must be positive'; end if;
  v_total_cents := ceil(p_shares * p_price_cents * 10)::bigint;
  if v_total_cents <= 0 then raise exception 'total must be positive'; end if;

  perform 1 from wallet where discord_user_id = p_user_id for update;
  select coalesce(sum(amount_cents), 0) into v_balance
    from wb_ledger where discord_user_id = p_user_id;
  if v_balance < v_total_cents then
    raise exception 'insufficient funds: balance=% requested=%', v_balance, v_total_cents;
  end if;

  insert into invest_order (discord_user_id, symbol, side, shares, price_cents, total_cents)
    values (p_user_id, p_symbol, 'buy', p_shares, p_price_cents, v_total_cents)
    returning id into v_order_id;

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
    values (p_user_id, -v_total_cents, 'invest_buy', 'invest_order', v_order_id::text,
            'Bought ' || p_shares || ' ' || p_symbol,
            jsonb_build_object('symbol', p_symbol, 'shares', p_shares, 'price_cents', p_price_cents));

  select shares, cost_basis_cents into v_existing_shares, v_existing_basis
    from invest_position where discord_user_id = p_user_id and symbol = p_symbol for update;

  if v_existing_shares is null then
    insert into invest_position (discord_user_id, symbol, shares, cost_basis_cents)
      values (p_user_id, p_symbol, p_shares, v_total_cents);
  else
    update invest_position
      set shares = v_existing_shares + p_shares,
          cost_basis_cents = v_existing_basis + v_total_cents,
          updated_at = now()
      where discord_user_id = p_user_id and symbol = p_symbol;
  end if;

  return v_order_id;
end;
$$;

create or replace function fn_invest_sell(
  p_user_id text, p_symbol text, p_shares numeric(20,6), p_price_cents bigint
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_total_cents bigint;
  v_existing_shares numeric(20,6);
  v_existing_basis bigint;
  v_basis_removed bigint;
  v_order_id bigint;
begin
  if p_shares <= 0 then raise exception 'shares must be positive'; end if;
  if p_price_cents <= 0 then raise exception 'price must be positive'; end if;

  perform 1 from wallet where discord_user_id = p_user_id for update;

  select shares, cost_basis_cents into v_existing_shares, v_existing_basis
    from invest_position where discord_user_id = p_user_id and symbol = p_symbol for update;
  if v_existing_shares is null or v_existing_shares < p_shares then
    raise exception 'position too small: have=% requested=%',
      coalesce(v_existing_shares, 0), p_shares;
  end if;

  v_total_cents := floor(p_shares * p_price_cents * 10)::bigint;
  if v_total_cents <= 0 then raise exception 'total must be positive'; end if;

  insert into invest_order (discord_user_id, symbol, side, shares, price_cents, total_cents)
    values (p_user_id, p_symbol, 'sell', p_shares, p_price_cents, v_total_cents)
    returning id into v_order_id;

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
    values (p_user_id, v_total_cents, 'invest_sell', 'invest_order', v_order_id::text,
            'Sold ' || p_shares || ' ' || p_symbol,
            jsonb_build_object('symbol', p_symbol, 'shares', p_shares, 'price_cents', p_price_cents));

  v_basis_removed := floor(v_existing_basis::numeric * p_shares / v_existing_shares)::bigint;

  if v_existing_shares - p_shares < 0.000001 then
    delete from invest_position
      where discord_user_id = p_user_id and symbol = p_symbol;
  else
    update invest_position
      set shares = v_existing_shares - p_shares,
          cost_basis_cents = greatest(v_existing_basis - v_basis_removed, 0),
          updated_at = now()
      where discord_user_id = p_user_id and symbol = p_symbol;
  end if;

  return v_order_id;
end;
$$;

revoke execute on function public.fn_invest_buy(text, text, numeric, bigint)  from anon, authenticated, public;
revoke execute on function public.fn_invest_sell(text, text, numeric, bigint) from anon, authenticated, public;

-- ===========================================================================
-- 4. fn_post_dividend: credit each holder shares × wb_cents_per_share.
--    Idempotent per (symbol, ex_date, user).
-- ===========================================================================
create or replace function fn_post_dividend(
  p_symbol text, p_ex_date date, p_wb_cents_per_share bigint
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_rec record;
  v_credit_cents bigint;
  v_credited int := 0;
  v_ref_id text;
  v_count int;
begin
  if p_wb_cents_per_share <= 0 then
    raise exception 'per-share amount must be positive';
  end if;

  for v_rec in
    select discord_user_id, shares
    from invest_position
    where symbol = p_symbol and shares > 0
  loop
    v_credit_cents := floor(v_rec.shares * p_wb_cents_per_share)::bigint;
    if v_credit_cents <= 0 then continue; end if;

    v_ref_id := p_symbol || ':' || to_char(p_ex_date, 'YYYY-MM-DD') || ':' || v_rec.discord_user_id;
    with ins as (
      insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
        values (
          v_rec.discord_user_id, v_credit_cents, 'invest_dividend', 'dividend', v_ref_id,
          'Dividend ' || p_symbol || ' ex ' || to_char(p_ex_date, 'YYYY-MM-DD'),
          jsonb_build_object(
            'symbol', p_symbol,
            'ex_date', to_char(p_ex_date, 'YYYY-MM-DD'),
            'shares', v_rec.shares,
            'wb_cents_per_share', p_wb_cents_per_share
          )
        )
        on conflict (ref_kind, ref_id)
          where ref_kind is not null and ref_id is not null
          do nothing
        returning 1
    )
    select count(*) into v_count from ins;
    v_credited := v_credited + coalesce(v_count, 0);
  end loop;

  return v_credited;
end;
$$;

revoke execute on function public.fn_post_dividend(text, date, bigint) from anon, authenticated, public;

-- ===========================================================================
-- 5. Recreate fn_user_lifetime_stats with dividend bucket.
-- ===========================================================================
drop function if exists fn_user_lifetime_stats(text);
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
  total_invest_dividend bigint,
  total_adjustment      bigint,
  ledger_row_count      bigint
)
language sql stable security definer set search_path = public
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
    coalesce(sum(amount_cents) filter (where kind = 'invest_dividend'), 0)::bigint,
    coalesce(sum(amount_cents) filter (where kind = 'adjustment'),      0)::bigint,
    count(*)::bigint
  from wb_ledger
  where discord_user_id = p_user_id;
$$;

revoke execute on function public.fn_user_lifetime_stats(text) from anon, authenticated, public;

-- ===========================================================================
-- 6. Persistent log of dividends posted (so the daily cron knows what's
--    already been distributed and can be queried for admin display).
-- ===========================================================================
create table if not exists wb_dividend (
  id bigserial primary key,
  symbol text not null,
  ex_date date not null,
  wb_cents_per_share bigint not null check (wb_cents_per_share > 0),
  source text not null,                -- 'admin_manual' | 'twelve_data'
  posted_by text,                       -- discord_user_id of admin, if manual
  users_credited int not null default 0,
  created_at timestamptz not null default now(),
  unique (symbol, ex_date)
);
alter table wb_dividend enable row level security;