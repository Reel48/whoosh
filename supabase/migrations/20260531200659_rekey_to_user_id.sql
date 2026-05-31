-- Re-key the money engine from "Discord user id" to the app user id.
--
-- DECISION (see plan): we do NOT physically rename the `discord_user_id`
-- columns — 23 money-engine functions and many lib queries reference them, and
-- renaming would force recreating all of them on a live ledger. Instead we
-- REPURPOSE the meaning of the existing key:
--
--   wallet.discord_user_id (and every table keyed off it) now holds THE APP
--   USER KEY — the Supabase auth.users.id (as text) for accounts created under
--   the new auth system, and the legacy Discord snowflake for rows that haven't
--   been claimed yet.
--
-- The user's actual Discord snowflake now lives in `profile.discord_user_id`.
--
-- Because there are 0 auth users today, existing wallets keep their Discord-id
-- key until that Discord user signs in through the new auth system, at which
-- point `claim_legacy_wallet` re-keys their rows to the new auth id.

comment on column wallet.discord_user_id is
  'App user key: Supabase auth.users.id (text) for new accounts; legacy Discord snowflake until claimed via claim_legacy_wallet(). The real Discord id lives in profile.discord_user_id.';

-- ---------------------------------------------------------------------------
-- Add ON UPDATE CASCADE to every FK referencing wallet, so a single re-key of
-- the wallet PK propagates to all child rows atomically. Each constraint keeps
-- its existing ON DELETE behavior.
-- ---------------------------------------------------------------------------
alter table bet_event       drop constraint bet_event_created_by_fkey,
  add constraint bet_event_created_by_fkey
    foreign key (created_by) references wallet(discord_user_id) on update cascade;

alter table bet_wager       drop constraint bet_wager_discord_user_id_fkey,
  add constraint bet_wager_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade;

alter table interest_accrual drop constraint interest_accrual_discord_user_id_fkey,
  add constraint interest_accrual_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade;

alter table invest_order    drop constraint invest_order_discord_user_id_fkey,
  add constraint invest_order_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade;

alter table invest_position drop constraint invest_position_discord_user_id_fkey,
  add constraint invest_position_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade;

alter table notification    drop constraint notification_discord_user_id_fkey,
  add constraint notification_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table referral_code   drop constraint referral_code_discord_user_id_fkey,
  add constraint referral_code_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table referral_use    drop constraint referral_use_referred_user_id_fkey,
  add constraint referral_use_referred_user_id_fkey
    foreign key (referred_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table referral_use    drop constraint referral_use_referrer_user_id_fkey,
  add constraint referral_use_referrer_user_id_fkey
    foreign key (referrer_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table user_achievement drop constraint user_achievement_discord_user_id_fkey,
  add constraint user_achievement_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table user_daily_bonus drop constraint user_daily_bonus_discord_user_id_fkey,
  add constraint user_daily_bonus_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table user_watchlist  drop constraint user_watchlist_discord_user_id_fkey,
  add constraint user_watchlist_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade on delete cascade;

alter table wb_ledger       drop constraint wb_ledger_discord_user_id_fkey,
  add constraint wb_ledger_discord_user_id_fkey
    foreign key (discord_user_id) references wallet(discord_user_id) on update cascade on delete restrict;

alter table wb_transfer     drop constraint wb_transfer_from_user_fkey,
  add constraint wb_transfer_from_user_fkey
    foreign key (from_user) references wallet(discord_user_id) on update cascade;

alter table wb_transfer     drop constraint wb_transfer_to_user_fkey,
  add constraint wb_transfer_to_user_fkey
    foreign key (to_user) references wallet(discord_user_id) on update cascade;

-- ---------------------------------------------------------------------------
-- claim_legacy_wallet: when an existing Discord user authenticates under the
-- new system, move their wallet + all child rows from their Discord-id key to
-- their new auth-id key. Idempotent; safe no-op when there's nothing to claim.
--
-- The single `update wallet` cascades through the 15 FKs above. Two fantasy
-- tables are keyed by discord_user_id WITHOUT a FK to wallet, so they're moved
-- explicitly here.
-- ---------------------------------------------------------------------------
create or replace function claim_legacy_wallet(
  p_discord_user_id text,
  p_new_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_discord_user_id is null
     or p_new_user_id is null
     or p_discord_user_id = p_new_user_id then
    return false;
  end if;

  -- Nothing under the Discord key → nothing to claim.
  if not exists (select 1 from wallet where discord_user_id = p_discord_user_id) then
    return false;
  end if;

  -- The new user already has a wallet → merging balances is out of scope; skip.
  if exists (select 1 from wallet where discord_user_id = p_new_user_id) then
    raise warning 'claim_legacy_wallet: target % already has a wallet; skipping claim of %',
      p_new_user_id, p_discord_user_id;
    return false;
  end if;

  -- Re-key the wallet PK; FK children cascade automatically.
  update wallet set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- FK-less tables keyed by the same id must be moved by hand.
  update fantasy_entitlement set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
  update fantasy_link        set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  return true;
end;
$$;

-- Powerful re-key function: server (service role) only.
revoke all on function claim_legacy_wallet(text, text) from public, anon, authenticated;
