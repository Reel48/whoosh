-- Sports betting lines: extend the generic prediction-market engine to carry
-- external (odds-API) games, market type, point lines, and per-wager frozen
-- lines, plus a score-based settlement function.

-- 1. bet_event: link to external games + market metadata.
alter table public.bet_event
  add column if not exists source text not null default 'manual',
  add column if not exists external_event_id text,
  add column if not exists sport_key text,
  add column if not exists market text,
  add column if not exists home_team text,
  add column if not exists away_team text,
  add column if not exists commence_time timestamptz,
  add column if not exists last_synced_at timestamptz;

alter table public.bet_event drop constraint if exists bet_event_source_check;
alter table public.bet_event add constraint bet_event_source_check
  check (source in ('manual', 'odds_api'));

alter table public.bet_event drop constraint if exists bet_event_market_check;
alter table public.bet_event add constraint bet_event_market_check
  check (market is null or market in ('h2h', 'spreads', 'totals'));

create unique index if not exists bet_event_external_market_uniq
  on public.bet_event (external_event_id, market)
  where source = 'odds_api';

-- 2. bet_outcome: the line (point) + a stable match key for upsert/settlement.
alter table public.bet_outcome
  add column if not exists point numeric,
  add column if not exists outcome_key text;

create unique index if not exists bet_outcome_event_key_uniq
  on public.bet_outcome (event_id, outcome_key)
  where outcome_key is not null;

-- 3. bet_wager: freeze the line at placement (lines move between syncs).
alter table public.bet_wager
  add column if not exists point_frozen numeric;

-- 4. fn_place_wager: capture point_frozen + reject once closes_at has passed.
create or replace function public.fn_place_wager(p_user_id text, p_event_id bigint, p_outcome_id bigint, p_stake_cents bigint)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event_status text;
  v_closes_at timestamptz;
  v_outcome_event bigint;
  v_odds numeric(10,3);
  v_point numeric;
  v_balance bigint;
  v_wager_id bigint;
begin
  if p_stake_cents <= 0 then
    raise exception 'stake must be positive';
  end if;

  -- Lock the event row so concurrent settle/cancel can't race the placement.
  select status, closes_at into v_event_status, v_closes_at
    from bet_event where id = p_event_id for update;
  if v_event_status is null then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_event_status <> 'open' then
    raise exception 'event % is not open (status=%)', p_event_id, v_event_status;
  end if;
  if v_closes_at is not null and v_closes_at <= now() then
    raise exception 'event % is not open (betting closed at %)', p_event_id, v_closes_at;
  end if;

  select event_id, odds_decimal, point into v_outcome_event, v_odds, v_point
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

  insert into bet_wager (event_id, outcome_id, discord_user_id, stake_cents, odds_decimal_frozen, point_frozen, status)
    values (p_event_id, p_outcome_id, p_user_id, p_stake_cents, v_odds, v_point, 'open')
    returning id into v_wager_id;

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
    values (p_user_id, -p_stake_cents, 'bet_stake', 'wager', v_wager_id::text,
            'Stake on event ' || p_event_id,
            jsonb_build_object('event_id', p_event_id, 'outcome_id', p_outcome_id));

  return v_wager_id;
end;
$function$;

-- 5. fn_settle_event_by_score: settle a sports event from its final score.
--    Settles PER WAGER because frozen points can differ between users.
--    h2h: winner by score (home/away/Draw). spreads: margin + point_frozen.
--    totals: (home+away) vs point_frozen. Tie on the line => push (refund).
create or replace function public.fn_settle_event_by_score(p_event_id bigint, p_home_score integer, p_away_score integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_status text;
  v_market text;
  v_home text;
  v_away text;
  v_winner_name text;
  v_rec record;
  v_outcome_key text;
  v_point numeric;
  v_result text;            -- 'won' | 'lost' | 'push'
  v_margin numeric;
  v_total numeric;
  v_payout_cents bigint;
  v_settled int := 0;
  v_winning_outcome bigint;
  v_distinct_keys int;
begin
  select status, market, home_team, away_team
    into v_status, v_market, v_home, v_away
    from bet_event where id = p_event_id for update;
  if v_status is null then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_status in ('settled', 'cancelled') then
    return 0;
  end if;
  if v_market is null then
    raise exception 'event % has no market; use fn_settle_event', p_event_id;
  end if;

  if p_home_score > p_away_score then
    v_winner_name := v_home;
  elsif p_away_score > p_home_score then
    v_winner_name := v_away;
  else
    v_winner_name := 'Draw';
  end if;

  for v_rec in
    select w.id, w.discord_user_id, w.stake_cents, w.odds_decimal_frozen,
           w.point_frozen, o.outcome_key
    from bet_wager w
    join bet_outcome o on o.id = w.outcome_id
    where w.event_id = p_event_id and w.status = 'open'
  loop
    v_outcome_key := v_rec.outcome_key;
    v_point := v_rec.point_frozen;

    if v_market = 'h2h' then
      if v_outcome_key = v_winner_name then
        v_result := 'won';
      else
        v_result := 'lost';
      end if;

    elsif v_market = 'spreads' then
      -- outcome_key is a team name; margin from that team's perspective.
      if v_outcome_key = v_home then
        v_margin := p_home_score - p_away_score;
      elsif v_outcome_key = v_away then
        v_margin := p_away_score - p_home_score;
      else
        v_margin := null; -- unknown team; treat as push (refund) defensively
      end if;
      if v_margin is null or v_point is null then
        v_result := 'push';
      elsif v_margin + v_point > 0 then
        v_result := 'won';
      elsif v_margin + v_point = 0 then
        v_result := 'push';
      else
        v_result := 'lost';
      end if;

    elsif v_market = 'totals' then
      v_total := p_home_score + p_away_score;
      if v_point is null then
        v_result := 'push';
      elsif v_outcome_key = 'over' then
        if v_total > v_point then v_result := 'won';
        elsif v_total = v_point then v_result := 'push';
        else v_result := 'lost'; end if;
      elsif v_outcome_key = 'under' then
        if v_total < v_point then v_result := 'won';
        elsif v_total = v_point then v_result := 'push';
        else v_result := 'lost'; end if;
      else
        v_result := 'push';
      end if;

    else
      v_result := 'push';
    end if;

    if v_result = 'won' then
      v_payout_cents := floor(v_rec.stake_cents::numeric * v_rec.odds_decimal_frozen)::bigint;
      update bet_wager set status = 'won' where id = v_rec.id;
      insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
        values (v_rec.discord_user_id, v_payout_cents, 'bet_payout',
                'wager_payout', v_rec.id::text,
                'Payout on event ' || p_event_id,
                jsonb_build_object('event_id', p_event_id, 'wager_id', v_rec.id, 'stake_cents', v_rec.stake_cents))
        on conflict (ref_kind, ref_id) where ref_kind is not null and ref_id is not null
        do nothing;
    elsif v_result = 'push' then
      update bet_wager set status = 'refunded' where id = v_rec.id;
      insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
        values (v_rec.discord_user_id, v_rec.stake_cents, 'bet_payout',
                'wager_refund', v_rec.id::text,
                'Push refund on event ' || p_event_id,
                jsonb_build_object('event_id', p_event_id, 'wager_id', v_rec.id))
        on conflict (ref_kind, ref_id) where ref_kind is not null and ref_id is not null
        do nothing;
    else
      update bet_wager set status = 'lost' where id = v_rec.id;
    end if;

    v_settled := v_settled + 1;
  end loop;

  -- Set settled_outcome_id only when unambiguous (single winning outcome row).
  select count(distinct outcome_id), min(outcome_id)
    into v_distinct_keys, v_winning_outcome
    from bet_wager
    where event_id = p_event_id and status = 'won';
  update bet_event
    set status = 'settled',
        settled_outcome_id = case when v_distinct_keys = 1 then v_winning_outcome else null end
    where id = p_event_id;

  return v_settled;
end;
$function$;