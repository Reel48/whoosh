-- Re-assert the RPC lockdown invariant from 20260528150214_wb_lock_down_rpc.sql:
-- "only the service role should call SECURITY DEFINER functions." The browser
-- never reaches Supabase directly for these — every caller below goes through
-- the service-role client (`@/lib/supabase`, `supabase().rpc(...)`), which
-- bypasses both RLS and these REVOKEs.
--
-- The original lockdown only covered the first three WB engine functions. Every
-- SECURITY DEFINER function added in later migrations (entitlements, betting
-- settle, news engagement, daily bonus, dashboard/leaderboard helpers) was left
-- callable by `anon`/`authenticated` over PostgREST RPC. Supabase advisors flag
-- all of them; this closes the gap. Most important: assign_league_entitlement,
-- which grants PAID Fantasy league access.

-- Privileged writes ------------------------------------------------------------
-- Granted paid entitlements; settled bets; mutated balances/bonuses.
revoke execute on function public.assign_league_entitlement(text, text, text, text, integer, text, text) from anon, authenticated, public;
revoke execute on function public.fn_claim_daily_bonus(text)                                              from anon, authenticated, public;
revoke execute on function public.fn_settle_event_by_score(bigint, integer, integer)                      from anon, authenticated, public;
revoke execute on function public.record_news_swipe(uuid, jsonb, text)                                    from anon, authenticated, public;
revoke execute on function public.delete_news_swipe(uuid, text)                                           from anon, authenticated, public;

-- handle_new_user() is the auth.users INSERT trigger. It fires as the definer
-- regardless of EXECUTE grants, so revoking RPC access can't break signup; it
-- only removes an endpoint that should never have been callable.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Read-only analytics / leaderboard helpers ------------------------------------
-- The app reaches these via the service role too (src/lib/wb/leaderboard.ts,
-- admin.ts, bonus.ts), so revoking matches the invariant. If a public read path
-- is ever wanted, grant EXECUTE back to `authenticated` explicitly with a note.
revoke execute on function public.fn_user_streak(text)                          from anon, authenticated, public;
revoke execute on function public.fn_wb_dau(integer)                            from anon, authenticated, public;
revoke execute on function public.fn_wb_supply_series(integer)                  from anon, authenticated, public;
revoke execute on function public.fn_wb_total_supply()                          from anon, authenticated, public;
revoke execute on function public.fn_wb_leaderboard_biggest_wins(integer, integer) from anon, authenticated, public;
revoke execute on function public.fn_wb_leaderboard_streaks(integer)            from anon, authenticated, public;
revoke execute on function public.fn_wb_leaderboard_traders(integer, integer)   from anon, authenticated, public;

-- Function search_path hardening ----------------------------------------------
-- Pin search_path on the two trigger helpers the advisor flagged as mutable
-- (handle_new_user already sets it). Prevents search_path-based shadowing.
alter function public.touch_profile_updated_at() set search_path = public;
alter function public.normalize_handle(text)     set search_path = public;
