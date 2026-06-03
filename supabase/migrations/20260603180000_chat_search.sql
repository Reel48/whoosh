-- Full-text search over chat messages (Postgres FTS — ample for ≤100 users).
--
-- A generated `tsvector` column + GIN index makes message bodies searchable; the
-- search RPC scopes results to channels the caller may read (via chat_can_read),
-- so DMs and role-gated channels never leak.

alter table public.chat_message
  add column if not exists body_tsv tsvector
  generated always as (to_tsvector('english', coalesce(body, ''))) stored;

create index if not exists chat_message_body_tsv_idx on public.chat_message using gin (body_tsv);

create or replace function public.search_chat_messages(
  p_user uuid, p_query text, p_channel bigint, p_limit integer
) returns setof public.chat_message
language sql stable security definer set search_path = public
as $$
  select m.*
    from chat_message m
   where m.deleted_at is null
     and m.body_tsv @@ websearch_to_tsquery('english', p_query)
     and (p_channel is null or m.channel_id = p_channel)
     and chat_can_read(m.channel_id, p_user)
   order by m.id desc
   limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
