-- Helper: ensure a wallet row exists for a Discord user before any ledger insert.
-- Called by the app on first balance read or any credit/debit.
create or replace function ensure_wallet(p_user_id text, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallet (discord_user_id, discord_username)
  values (p_user_id, p_username)
  on conflict (discord_user_id) do update
    set discord_username = excluded.discord_username
    where wallet.discord_username is distinct from excluded.discord_username;
end;
$$;

-- Atomic P2P transfer. Raises if sender lacks funds. Inserts:
--   1. transfer_out ledger row for sender
--   2. transfer_in  ledger row for recipient
--   3. wb_transfer record
-- All in one transaction (the function body runs in a single txn).
create or replace function fn_transfer(
  p_from text,
  p_to text,
  p_amount_cents bigint,
  p_memo text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_transfer_id bigint;
begin
  if p_from = p_to then
    raise exception 'cannot transfer to yourself';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Lock the sender row to serialize concurrent transfers from same user.
  perform 1 from wallet where discord_user_id = p_from for update;

  select coalesce(sum(amount_cents), 0) into v_balance
    from wb_ledger where discord_user_id = p_from;

  if v_balance < p_amount_cents then
    raise exception 'insufficient funds: balance=% requested=%', v_balance, p_amount_cents;
  end if;

  insert into wb_transfer (from_user, to_user, amount_cents, memo)
    values (p_from, p_to, p_amount_cents, p_memo)
    returning id into v_transfer_id;

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo)
    values (p_from, -p_amount_cents, 'transfer_out', 'transfer', v_transfer_id::text, p_memo);

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo)
    values (p_to, p_amount_cents, 'transfer_in', 'transfer', v_transfer_id::text, p_memo);

  return v_transfer_id;
end;
$$;

-- Idempotent ledger credit/debit. Used by webhooks and any external-event source.
-- Returns the ledger row id, or NULL if the (ref_kind, ref_id) was already used.
create or replace function fn_credit_ledger(
  p_user_id text,
  p_amount_cents bigint,
  p_kind text,
  p_ref_kind text,
  p_ref_id text,
  p_memo text,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo, metadata)
    values (p_user_id, p_amount_cents, p_kind, p_ref_kind, p_ref_id, p_memo, p_metadata)
    on conflict (ref_kind, ref_id) where ref_kind is not null and ref_id is not null
    do nothing
    returning id into v_id;
  return v_id;
end;
$$;