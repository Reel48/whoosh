-- News freshness: stale rows are *hidden* at read time (deck/community = 72h,
-- My Keeps = 14d), and this daily job *deletes* them so the tables stay bounded
-- and aged data is actually gone. 14 days is the outer window (My Keeps), so we
-- keep everything that any surface could still show and purge the rest.

create extension if not exists pg_cron;

create or replace function public.purge_stale_news() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Personal keeps (and all other swipes) older than 14 days.
  delete from news_swipe where updated_at < now() - interval '14 days';
  -- Articles past the outer window (fall back to created_at when undated).
  delete from news_article where coalesce(pub_date, created_at) < now() - interval '14 days';
  -- Dedup markers for long-gone articles (can never re-post: they're >72h old).
  delete from news_chat_post where posted_at < now() - interval '14 days';
end; $$;

revoke all on function public.purge_stale_news() from public;

-- Daily at 04:17 UTC (off-peak). Named schedule upserts on re-run.
select cron.schedule('purge-stale-news', '17 4 * * *', $$select public.purge_stale_news();$$);
