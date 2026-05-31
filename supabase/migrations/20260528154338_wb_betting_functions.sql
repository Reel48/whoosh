-- Place a wager. Atomic: debits stake from bettor + inserts wager row.
-- Raises if event isn't open, outcome doesn't belong to event, or insufficient funds.
-- Freezes odds at placement time so later admin edits to odds don't change payouts.
create or replace function fn_place_wager(
  p_user_id text,
  p_event_id bigint,
  p_outcome_id bigint,
  p_stake_cents bigint
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_status text;
  v_outcome_event bigint;
  v_odds numeric(10,3);
  v_balance bigint;
  v_wager_id bigint;
begin
  if p_stake_cents <= 0 then
    raise exception 'stake must be positive';
  end if;

  -- Lock the event row so concurrent settle/cancel can't race the placement.
  select status into v_event_status
    from bet_event where id = p_event_id for update;
  if v_event_status is null then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_event_status <> 'open' then
    raise exception 'event % is not open (status=%)', p_event_id, v_event_status;
  end if;

  select event_id, odds_decimal into v_outcome_event, v_odds
    from bet_outcome where id = p_outcome_id;
  if v_outcome_event is null then
    raise exception 'outcome % not found', p_outcome_id;
  end if;
  if v_outcome_event <> p_event_id then
    raise exception 'outcome % does not belong to event %', p_outcome_id, p_event_id;
  end if;

  -- Serialize against concurrent transfers/bets for the same user.
  perform 1 from wallet where discord_user_id = p_user_id for update;

  select coalesce(sum(amount_cents), 0) into v_balance
    from wb_ledger where discord_user_id = p_user_id;
  if v_balance < p_stake_cents then
    raise exception 'insufficient funds: balance=% requested=%', v_balance, p_stake_cents;
  end if;

  insert into bet_wager (event_id, outcome_id, discord_user_id, stake_cents, odds_decimal_frozen, status)
    values (p_event_id, p_outcome_id, p_user_id, p_stake_cents, v_odds, 'open')
    returning id into v_wager_id;

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
    values (p_user_id, -p_stake_cents, 'bet_stake', 'wager', v_wager_id::text,
            'Stake on event ' || p_event_id,
            jsonb_build_object('event_id', p_event_id, 'outcome_id', p_outcome_id));

  return v_wager_id;
end;
$$;

-- Settle an event: pay out wagers on the winning outcome at frozen odds,
-- mark losing wagers as lost. Idempotent — re-running on an already-settled
-- event with the same outcome is a no-op.
create or replace function fn_settle_event(
  p_event_id bigint,
  p_winning_outcome_id bigint
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_outcome_event bigint;
  v_rec record;
  v_payout_cents bigint;
  v_winners int := 0;
begin
  select status into v_status from bet_event where id = p_event_id for update;
  if v_status is null then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_status = 'cancelled' then
    raise exception 'event % is cancelled; cannot settle', p_event_id;
  end if;

  select event_id into v_outcome_event from bet_outcome where id = p_winning_outcome_id;
  if v_outcome_event <> p_event_id then
    raise exception 'outcome % does not belong to event %', p_winning_outcome_id, p_event_id;
  end if;

  -- Mark all open wagers on this event as won/lost.
  update bet_wager
    set status = case when outcome_id = p_winning_outcome_id then 'won' else 'lost' end
    where event_id = p_event_id and status = 'open';

  -- Credit each winner. Payout = floor(stake * odds_frozen). Idempotent via
  -- (ref_kind='wager_payout', ref_id=wager_id).
  for v_rec in
    select id, discord_user_id, stake_cents, odds_decimal_frozen
    from bet_wager
    where event_id = p_event_id
      and outcome_id = p_winning_outcome_id
      and status = 'won'
  loop
    v_payout_cents := floor(v_rec.stake_cents::numeric * v_rec.odds_decimal_frozen)::bigint;
    insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
      values (v_rec.discord_user_id, v_payout_cents, 'bet_payout',
              'wager_payout', v_rec.id::text,
              'Payout on event ' || p_event_id,
              jsonb_build_object('event_id', p_event_id, 'wager_id', v_rec.id, 'stake_cents', v_rec.stake_cents))
      on conflict (ref_kind, ref_id) where ref_kind is not null and ref_id is not null
      do nothing;
    v_winners := v_winners + 1;
  end loop;

  update bet_event
    set status = 'settled', settled_outcome_id = p_winning_outcome_id
    where id = p_event_id;

  return v_winners;
end;
$$;

-- Cancel an open or locked event: refund all open wagers, mark cancelled.
create or replace function fn_cancel_event(p_event_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_rec record;
  v_refunded int := 0;
begin
  select status into v_status from bet_event where id = p_event_id for update;
  if v_status is null then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_status = 'settled' then
    raise exception 'event % already settled; cannot cancel', p_event_id;
  end if;
  if v_status = 'cancelled' then
    return 0;
  end if;

  for v_rec in
    select id, discord_user_id, stake_cents
    from bet_wager
    where event_id = p_event_id and status = 'open'
  loop
    insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
      values (v_rec.discord_user_id, v_rec.stake_cents, 'bet_payout',
              'wager_refund', v_rec.id::text,
              'Refund — event ' || p_event_id || ' cancelled',
              jsonb_build_object('event_id', p_event_id, 'wager_id', v_rec.id))
      on conflict (ref_kind, ref_id) where ref_kind is not null and ref_id is not null
      do nothing;
    v_refunded := v_refunded + 1;
  end loop;

  update bet_wager set status = 'refunded'
    where event_id = p_event_id and status = 'open';
  update bet_event set status = 'cancelled' where id = p_event_id;

  return v_refunded;
end;
$$;

revoke execute on function public.fn_place_wager(text, bigint, bigint, bigint) from anon, authenticated, public;
revoke execute on function public.fn_settle_event(bigint, bigint)               from anon, authenticated, public;
revoke execute on function public.fn_cancel_event(bigint)                       from anon, authenticated, public;