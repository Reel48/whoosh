-- Lock down SECURITY DEFINER functions: only the service role should call them.
-- The browser never reaches Supabase in v1; all access is server-side via the
-- service role key, which bypasses both RLS and these REVOKEs.
revoke execute on function public.ensure_wallet(text, text)                                              from anon, authenticated, public;
revoke execute on function public.fn_credit_ledger(text, bigint, text, text, text, text, jsonb)         from anon, authenticated, public;
revoke execute on function public.fn_transfer(text, text, bigint, text)                                  from anon, authenticated, public;

-- Views default to SECURITY DEFINER on Postgres 15+ unless explicitly set;
-- switch wallet_balance to SECURITY INVOKER so it enforces the caller's RLS.
alter view public.wallet_balance set (security_invoker = true);