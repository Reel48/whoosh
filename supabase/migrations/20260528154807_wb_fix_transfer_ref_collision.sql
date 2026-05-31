-- Bug: the two ledger rows created by a transfer both wrote
-- ref_kind='transfer', ref_id=<transfer_id>, which collides on the
-- (ref_kind, ref_id) UNIQUE index. Disambiguate by suffixing :out / :in
-- so idempotency still applies per leg.
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
    values (p_from, -p_amount_cents, 'transfer_out', 'transfer', v_transfer_id::text || ':out', p_memo);

  insert into wb_ledger (discord_user_id, amount_cents, kind, ref_kind, ref_id, memo)
    values (p_to, p_amount_cents, 'transfer_in', 'transfer', v_transfer_id::text || ':in', p_memo);

  return v_transfer_id;
end;
$$;

revoke execute on function public.fn_transfer(text, text, bigint, text) from anon, authenticated, public;