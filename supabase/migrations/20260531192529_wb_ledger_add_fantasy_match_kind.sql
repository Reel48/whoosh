alter table public.wb_ledger drop constraint wb_ledger_kind_check;
alter table public.wb_ledger add constraint wb_ledger_kind_check
  check (kind = any (array[
    'purchase'::text, 'premium_match'::text, 'fantasy_match'::text, 'interest'::text,
    'transfer_in'::text, 'transfer_out'::text, 'bet_stake'::text, 'bet_payout'::text,
    'invest_buy'::text, 'invest_sell'::text, 'invest_dividend'::text, 'daily_bonus'::text,
    'referral_reward'::text, 'adjustment'::text
  ]));
