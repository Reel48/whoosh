-- WB leaderboard. "Total WB" is cash + invested cost basis + open wager stakes.
-- We use cost basis (not market value) for positions to keep the query cheap
-- and deterministic — no external price lookups in the SQL path.
create or replace function fn_wb_leaderboard(p_limit int default 10)
returns table (
  rank                       bigint,
  discord_user_id            text,
  discord_username           text,
  cash_cents                 bigint,
  invested_cost_basis_cents  bigint,
  open_wager_stakes_cents    bigint,
  total_wb_cents             bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with cash as (
    select discord_user_id, coalesce(sum(amount_cents), 0)::bigint as cents
    from wb_ledger
    group by discord_user_id
  ),
  invested as (
    select discord_user_id, coalesce(sum(cost_basis_cents), 0)::bigint as cents
    from invest_position
    group by discord_user_id
  ),
  staked as (
    select discord_user_id, coalesce(sum(stake_cents), 0)::bigint as cents
    from bet_wager
    where status = 'open'
    group by discord_user_id
  ),
  totals as (
    select
      w.discord_user_id,
      w.discord_username,
      coalesce(c.cents, 0) as cash_cents,
      coalesce(i.cents, 0) as invested_cost_basis_cents,
      coalesce(s.cents, 0) as open_wager_stakes_cents,
      coalesce(c.cents, 0) + coalesce(i.cents, 0) + coalesce(s.cents, 0) as total_wb_cents
    from wallet w
    left join cash     c on c.discord_user_id = w.discord_user_id
    left join invested i on i.discord_user_id = w.discord_user_id
    left join staked   s on s.discord_user_id = w.discord_user_id
  )
  select
    row_number() over (order by total_wb_cents desc, discord_user_id asc) as rank,
    discord_user_id,
    discord_username,
    cash_cents,
    invested_cost_basis_cents,
    open_wager_stakes_cents,
    total_wb_cents
  from totals
  where total_wb_cents > 0
  order by total_wb_cents desc, discord_user_id asc
  limit p_limit;
$$;

revoke execute on function public.fn_wb_leaderboard(int) from anon, authenticated, public;