-- Atomic buy: debit WB, upsert position (weighted avg cost basis), record order.
create or replace function fn_invest_buy(
  p_user_id text,
  p_symbol text,
  p_shares numeric(20,6),
  p_price_cents bigint
) returns bigint
language plpgsql
security definer
set search_path = public
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

  v_total_cents := ceil(p_shares * p_price_cents)::bigint;
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

  -- Upsert position with weighted-average cost basis.
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

-- Atomic sell: credit WB, decrement position (proportional cost basis removal),
-- record order. Raises if position too small.
create or replace function fn_invest_sell(
  p_user_id text,
  p_symbol text,
  p_shares numeric(20,6),
  p_price_cents bigint
) returns bigint
language plpgsql
security definer
set search_path = public
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

  v_total_cents := floor(p_shares * p_price_cents)::bigint;
  if v_total_cents <= 0 then raise exception 'total must be positive'; end if;

  insert into invest_order (discord_user_id, symbol, side, shares, price_cents, total_cents)
    values (p_user_id, p_symbol, 'sell', p_shares, p_price_cents, v_total_cents)
    returning id into v_order_id;

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
    values (p_user_id, v_total_cents, 'invest_sell', 'invest_order', v_order_id::text,
            'Sold ' || p_shares || ' ' || p_symbol,
            jsonb_build_object('symbol', p_symbol, 'shares', p_shares, 'price_cents', p_price_cents));

  -- Remove cost basis proportional to shares sold.
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