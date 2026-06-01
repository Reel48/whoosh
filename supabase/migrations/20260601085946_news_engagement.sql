-- Sports News engagement: swipe-to-keep / swipe-to-trash + the Whoosh Feed.
--
-- ESPN articles are ephemeral (fetched live, no DB row). We lazily persist an
-- article row the first time anyone swipes it, carrying the metadata the client
-- sends. `points` is a denormalized count of right-swipes (keeps), recomputed in
-- record_news_swipe so the Whoosh Feed ranks with one indexed read.
--
-- Service-role only: RLS on, no policies (matches the rest of the schema).

create table if not exists public.news_article (
  espn_id     text primary key,           -- = Article.guid (ESPN id, or link)
  sport       text not null,              -- SportKey the article was kept from
  title       text not null,
  description text,
  link        text not null,
  author      text,
  image_url   text,
  pub_date    timestamptz,
  points      integer not null default 0, -- count of right-swipes (see RPC)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.news_article enable row level security;
-- Whoosh Feed ranking: kept articles, points desc.
create index if not exists news_article_points_idx
  on public.news_article (points desc) where points > 0;

-- One row per (user, article). Direction toggled via upsert; the PK structurally
-- guarantees one swipe (hence at most one point) per user per article.
create table if not exists public.news_swipe (
  user_id    uuid not null references auth.users(id) on delete cascade,
  espn_id    text not null references public.news_article(espn_id) on delete cascade,
  direction  text not null check (direction in ('left','right')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, espn_id)
);
alter table public.news_swipe enable row level security;
-- Bulk lookup of a user's swipes for the guids on the current page.
create index if not exists news_swipe_user_idx on public.news_swipe (user_id);
-- Recompute count of right-swipes for an article.
create index if not exists news_swipe_article_right_idx
  on public.news_swipe (espn_id) where direction = 'right';

-- ---------------------------------------------------------------------------
-- Record a swipe in one transaction: lazily upsert the article from the client
-- payload, upsert the swipe (toggling direction), then recompute the article's
-- points from scratch (correct under right->left toggles and re-swipes — no
-- increment/decrement drift). Returns the new global points total.
--
-- SECURITY DEFINER so it runs past RLS. The row lock serializes concurrent
-- swipes on the same article.
-- ---------------------------------------------------------------------------
create or replace function record_news_swipe(
  p_user uuid,
  p_article jsonb,   -- {espn_id,sport,title,description,link,author,image_url,pub_date}
  p_direction text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_espn_id text := nullif(p_article->>'espn_id', '');
  v_points  integer;
begin
  if v_espn_id is null then
    raise exception 'missing espn_id';
  end if;
  if p_direction not in ('left','right') then
    raise exception 'bad direction: %', p_direction;
  end if;

  insert into news_article
    (espn_id, sport, title, description, link, author, image_url, pub_date)
  values (
    v_espn_id,
    coalesce(nullif(p_article->>'sport', ''), 'unknown'),
    coalesce(nullif(p_article->>'title', ''), 'Untitled'),
    p_article->>'description',
    coalesce(nullif(p_article->>'link', ''), ''),
    p_article->>'author',
    p_article->>'image_url',
    nullif(p_article->>'pub_date', '')::timestamptz
  )
  on conflict (espn_id) do update
    set title       = excluded.title,
        description = excluded.description,
        link        = excluded.link,
        author      = excluded.author,
        image_url   = excluded.image_url,
        pub_date    = excluded.pub_date,
        sport       = excluded.sport,
        updated_at  = now();

  -- Serialize concurrent swipes on the same article before the recount.
  perform 1 from news_article where espn_id = v_espn_id for update;

  insert into news_swipe (user_id, espn_id, direction)
  values (p_user, v_espn_id, p_direction)
  on conflict (user_id, espn_id) do update
    set direction = excluded.direction, updated_at = now();

  select count(*) into v_points
    from news_swipe where espn_id = v_espn_id and direction = 'right';

  update news_article set points = v_points, updated_at = now()
    where espn_id = v_espn_id;

  return v_points;
end;
$$;

-- Clean undo: remove a user's swipe entirely and recompute the article's points.
create or replace function delete_news_swipe(
  p_user uuid,
  p_espn_id text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
begin
  delete from news_swipe where user_id = p_user and espn_id = p_espn_id;

  select count(*) into v_points
    from news_swipe where espn_id = p_espn_id and direction = 'right';

  update news_article set points = v_points, updated_at = now()
    where espn_id = p_espn_id;

  return coalesce(v_points, 0);
end;
$$;
