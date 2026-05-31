-- Seed: 2% APY effective today as the bootstrap rate. The daily refresh
-- cron will overwrite tomorrow's row with the FRED 3-mo T-bill yield as a
-- SPAXX proxy. Admin can override at any time via fn_set_interest_rate.
insert into interest_rate (effective_date, apy_bps, source)
  values (current_date, 200, 'bootstrap')
  on conflict (effective_date) do nothing;

-- Get the most recent rate at or before a given date.
create or replace function fn_rate_for_date(p_date date)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select apy_bps
  from interest_rate
  where effective_date <= p_date
  order by effective_date desc
  limit 1;
$$;

-- Admin-set rate. Idempotent for same effective_date — last write wins.
create or replace function fn_set_interest_rate(
  p_effective_date date,
  p_apy_bps int,
  p_source text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into interest_rate (effective_date, apy_bps, source)
    values (p_effective_date, p_apy_bps, p_source)
    on conflict (effective_date) do update
      set apy_bps = excluded.apy_bps,
          source = excluded.source;
end;
$$;

-- Accrue daily interest into interest_accrual for the given date.
-- For each wallet with a positive balance AS OF that date:
--   accrual_cents = floor(balance * apy_bps / 10000 / 365)
-- Idempotent via the PK (discord_user_id, accrual_date).
create or replace function fn_accrue_interest(p_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apy_bps int;
  v_rows int;
begin
  v_apy_bps := fn_rate_for_date(p_date);
  if v_apy_bps is null then
    raise exception 'no interest_rate set on or before %', p_date;
  end if;

  with balances as (
    select discord_user_id,
           coalesce(sum(amount_cents), 0)::bigint as bal
    from wb_ledger
    where created_at < (p_date + 1)::timestamptz
    group by discord_user_id
  ),
  ins as (
    insert into interest_accrual (discord_user_id, accrual_date, amount_cents)
    select discord_user_id,
           p_date,
           (bal * v_apy_bps / 10000 / 365)::bigint
    from balances
    where bal > 0
      and (bal * v_apy_bps / 10000 / 365)::bigint > 0
    on conflict (discord_user_id, accrual_date) do nothing
    returning 1
  )
  select count(*) into v_rows from ins;

  return v_rows;
end;
$$;

-- Post all unposted accruals up to and including p_through_date as a single
-- 'interest' ledger row per user. Idempotent: uses (ref_kind='interest_post',
-- ref_id='<user>:<yyyy-mm-dd>') so re-running the same post date is a no-op.
create or replace function fn_post_interest(p_through_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users int := 0;
  v_rec record;
  v_credit_id bigint;
begin
  for v_rec in
    select discord_user_id, sum(amount_cents)::bigint as total
    from interest_accrual
    where posted = false
      and accrual_date <= p_through_date
    group by discord_user_id
    having sum(amount_cents) > 0
  loop
    insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo)
      values (
        v_rec.discord_user_id,
        v_rec.total,
        'interest',
        'interest_post',
        v_rec.discord_user_id || ':' || to_char(p_through_date, 'YYYY-MM-DD'),
        'Interest posted through ' || to_char(p_through_date, 'YYYY-MM-DD')
      )
      on conflict (ref_kind, ref_id)
        where ref_kind is not null and ref_id is not null
        do nothing
      returning id into v_credit_id;

    if v_credit_id is not null then
      update interest_accrual
        set posted = true
        where discord_user_id = v_rec.discord_user_id
          and accrual_date <= p_through_date
          and posted = false;
      v_users := v_users + 1;
    end if;
  end loop;

  return v_users;
end;
$$;

-- Total WB outstanding (sum of all balances). Used by the admin dashboard.
create or replace function fn_total_wb_outstanding()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::bigint from wb_ledger;
$$;

-- Lock down: only the service role calls these.
revoke execute on function public.fn_rate_for_date(date)                    from anon, authenticated, public;
revoke execute on function public.fn_set_interest_rate(date, int, text)     from anon, authenticated, public;
revoke execute on function public.fn_accrue_interest(date)                  from anon, authenticated, public;
revoke execute on function public.fn_post_interest(date)                    from anon, authenticated, public;
revoke execute on function public.fn_total_wb_outstanding()                 from anon, authenticated, public;