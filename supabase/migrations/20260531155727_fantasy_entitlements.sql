-- Per-league commerce config
alter table public.fantasy_league
  add column if not exists entry_fee_cents integer,
  add column if not exists join_url text,
  add column if not exists group_key text,
  add column if not exists capacity integer not null default 10,
  add column if not exists product_name text;

-- Paid entitlements: one row per buy-in (group+season), assigned to a concrete league
create table if not exists public.fantasy_entitlement (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null,
  discord_username text,
  group_key text not null,
  season text not null,
  assigned_league_id text references public.fantasy_league(sleeper_league_id),
  status text not null default 'active',
  amount_cents integer not null default 0,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists fantasy_entitlement_user_group_season
  on public.fantasy_entitlement (discord_user_id, group_key, season);
create index if not exists fantasy_entitlement_assigned
  on public.fantasy_entitlement (assigned_league_id);

alter table public.fantasy_entitlement enable row level security;

-- Atomic, idempotent assignment: balances buyers across interchangeable leagues
-- in a group by remaining capacity. Idempotent on stripe_session_id so the
-- webhook and the success-page finalizer can both call it safely.
create or replace function public.assign_league_entitlement(
  p_discord_user_id text,
  p_discord_username text,
  p_group_key text,
  p_season text,
  p_amount_cents integer,
  p_session_id text,
  p_payment_intent_id text
) returns public.fantasy_entitlement
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fantasy_entitlement;
  v_league text;
begin
  -- Already processed this checkout session?
  select * into v_row from public.fantasy_entitlement
   where stripe_session_id = p_session_id;
  if found then return v_row; end if;

  -- Already holds a spot in this group this season? (defensive)
  select * into v_row from public.fantasy_entitlement
   where discord_user_id = p_discord_user_id
     and group_key = p_group_key
     and season = p_season;
  if found then return v_row; end if;

  -- Pick the active league in the group with the most remaining capacity.
  select l.sleeper_league_id into v_league
    from public.fantasy_league l
    left join (
      select assigned_league_id, count(*) as c
        from public.fantasy_entitlement
       where season = p_season and status = 'active'
       group by assigned_league_id
    ) e on e.assigned_league_id = l.sleeper_league_id
   where coalesce(l.group_key, l.sleeper_league_id) = p_group_key
     and l.active
     and coalesce(e.c, 0) < l.capacity
   order by (l.capacity - coalesce(e.c, 0)) desc, l.sort asc
   limit 1;

  begin
    insert into public.fantasy_entitlement (
      discord_user_id, discord_username, group_key, season,
      assigned_league_id, status, amount_cents,
      stripe_session_id, stripe_payment_intent_id
    ) values (
      p_discord_user_id, p_discord_username, p_group_key, p_season,
      v_league,
      case when v_league is null then 'unassigned' else 'active' end,
      coalesce(p_amount_cents, 0), p_session_id, p_payment_intent_id
    )
    returning * into v_row;
  exception when unique_violation then
    -- Concurrent insert won the race; return the existing row.
    select * into v_row from public.fantasy_entitlement
     where (stripe_session_id = p_session_id)
        or (discord_user_id = p_discord_user_id and group_key = p_group_key and season = p_season)
     limit 1;
  end;

  return v_row;
end;
$$;