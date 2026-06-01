-- claim_legacy_wallet, v2: MERGE instead of skip.
--
-- Bug: the v1 function (see 20260531200659_rekey_to_user_id.sql) bailed out with
-- a warning whenever the new auth account ALREADY had a wallet — "merging
-- balances is out of scope". But that's the *normal* path: this app is
-- email-first with Discord linked later, so a returning Discord user typically
--   1. signs up by email,
--   2. gets a fresh auth-id-keyed wallet on their first /capital visit
--      (ensureWallet), then
--   3. links Discord — at which point claim_legacy_wallet runs and skips.
--
-- The result is an orphaned, still-funded legacy wallet that lingers under the
-- old Discord snowflake and shows up as a DUPLICATE row on the WB leaderboard
-- (the leaderboard joins `wallet`, so each wallet row is one entry).
--
-- Fix: when the target already has a wallet, fold every child row from the
-- legacy key into the new key and delete the legacy wallet row. The target
-- wallet already satisfies the FKs, so we re-key children directly rather than
-- relying on the wallet-PK ON UPDATE CASCADE (which would throw on the
-- composite-PK children, e.g. invest_position, the moment a key collides).
--
-- Idempotent and safe to call on every Discord-authenticated callback.

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

  -- Fast path: the new account has no wallet yet. Re-key the wallet PK and let
  -- the ON UPDATE CASCADE FKs carry every child row along atomically.
  if not exists (select 1 from wallet where discord_user_id = p_new_user_id) then
    update wallet            set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
    update fantasy_entitlement set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
    update fantasy_link      set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
    return true;
  end if;

  -- ----------------------------------------------------------------------
  -- MERGE path: target wallet exists. Move/merge each child off the legacy
  -- key, resolving the composite-PK collisions per table, then drop the
  -- legacy wallet row.
  -- ----------------------------------------------------------------------

  -- Surrogate-PK children: no per-user uniqueness, straight re-key.
  update wb_ledger          set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
  update bet_wager          set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
  update invest_order       set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
  update notification       set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
  update fantasy_entitlement set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;
  update bet_event          set created_by = p_new_user_id where created_by = p_discord_user_id;
  update wb_transfer         set from_user = p_new_user_id where from_user = p_discord_user_id;
  update wb_transfer         set to_user   = p_new_user_id where to_user   = p_discord_user_id;

  -- invest_position (pk: user, symbol): fold shares + cost basis for symbols
  -- held under both keys, then re-key the symbols held only under legacy.
  update invest_position np
     set shares           = np.shares + lp.shares,
         cost_basis_cents = np.cost_basis_cents + lp.cost_basis_cents,
         updated_at       = now()
    from invest_position lp
   where lp.discord_user_id = p_discord_user_id
     and np.discord_user_id = p_new_user_id
     and np.symbol = lp.symbol;
  delete from invest_position lp
   where lp.discord_user_id = p_discord_user_id
     and exists (select 1 from invest_position np
                  where np.discord_user_id = p_new_user_id and np.symbol = lp.symbol);
  update invest_position set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- The remaining per-user-keyed tables are historical/idempotent records:
  -- on a key collision, keep the target's row and drop the legacy duplicate.

  -- interest_accrual (pk: user, accrual_date)
  delete from interest_accrual lp
   where lp.discord_user_id = p_discord_user_id
     and exists (select 1 from interest_accrual np
                  where np.discord_user_id = p_new_user_id and np.accrual_date = lp.accrual_date);
  update interest_accrual set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- user_achievement (pk: user, code)
  delete from user_achievement lp
   where lp.discord_user_id = p_discord_user_id
     and exists (select 1 from user_achievement np
                  where np.discord_user_id = p_new_user_id and np.code = lp.code);
  update user_achievement set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- user_daily_bonus (pk: user, claim_date)
  delete from user_daily_bonus lp
   where lp.discord_user_id = p_discord_user_id
     and exists (select 1 from user_daily_bonus np
                  where np.discord_user_id = p_new_user_id and np.claim_date = lp.claim_date);
  update user_daily_bonus set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- user_watchlist (pk: user, symbol)
  delete from user_watchlist lp
   where lp.discord_user_id = p_discord_user_id
     and exists (select 1 from user_watchlist np
                  where np.discord_user_id = p_new_user_id and np.symbol = lp.symbol);
  update user_watchlist set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- referral_code (pk: user): keep the target's code if it already has one.
  delete from referral_code
   where discord_user_id = p_discord_user_id
     and exists (select 1 from referral_code where discord_user_id = p_new_user_id);
  update referral_code set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- referral_use: re-key referrer attribution always; referred_user_id is
  -- one-per-user, so keep the target's row on collision.
  update referral_use set referrer_user_id = p_new_user_id where referrer_user_id = p_discord_user_id;
  delete from referral_use
   where referred_user_id = p_discord_user_id
     and exists (select 1 from referral_use where referred_user_id = p_new_user_id);
  update referral_use set referred_user_id = p_new_user_id where referred_user_id = p_discord_user_id;

  -- fantasy_link (pk: user): keep the target's link if it already has one.
  delete from fantasy_link
   where discord_user_id = p_discord_user_id
     and exists (select 1 from fantasy_link where discord_user_id = p_new_user_id);
  update fantasy_link set discord_user_id = p_new_user_id where discord_user_id = p_discord_user_id;

  -- Every child now points at the new key; drop the orphaned legacy wallet.
  delete from wallet where discord_user_id = p_discord_user_id;

  return true;
end;
$$;

-- Powerful re-key function: server (service role) only.
revoke all on function claim_legacy_wallet(text, text) from public, anon, authenticated;
