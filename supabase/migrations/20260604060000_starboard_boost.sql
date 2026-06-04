-- Starboard swipe. A News-style deck over starboard-eligible messages (≥3 ⭐)
-- where users Boost or Meh; a Boost is +1 toward an all-time leaderboard of top
-- messages. Mirrors the news_swipe pattern: a per-(user,message) swipe row + a
-- denormalized boost_count recomputed by the RPC.

alter table public.chat_message add column if not exists boost_count integer not null default 0;
create index if not exists chat_message_boost_idx on public.chat_message(boost_count desc) where boost_count > 0;

create table if not exists public.starboard_boost (
  user_id uuid not null,
  message_id bigint not null references public.chat_message(id) on delete cascade,
  direction text not null check (direction in ('boost','meh')),
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists starboard_boost_msg_idx on public.starboard_boost(message_id);
alter table public.starboard_boost enable row level security;
-- No policies: only the SECURITY DEFINER RPCs below touch this table.

-- Record (or change) a boost/meh on a message; recomputes boost_count = number
-- of distinct boosters. Returns the new boost_count.
create or replace function public.record_starboard_boost(p_user uuid, p_message bigint, p_direction text)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_channel bigint; v_count integer; v_dir text := lower(coalesce(p_direction, ''));
begin
  if v_dir not in ('boost','meh') then raise exception 'validation'; end if;
  select m.channel_id into v_channel from chat_message m where m.id = p_message and m.deleted_at is null;
  if v_channel is null then raise exception 'not_found'; end if;
  if not chat_can_read(v_channel, p_user) then raise exception 'forbidden'; end if;

  insert into starboard_boost (user_id, message_id, direction)
  values (p_user, p_message, v_dir)
  on conflict (user_id, message_id) do update set direction = excluded.direction, created_at = now();

  select count(*)::int into v_count from starboard_boost b where b.message_id = p_message and b.direction = 'boost';
  update chat_message m set boost_count = v_count where m.id = p_message;
  return v_count;
end; $$;

-- Undo a swipe (re-deals the card); recomputes boost_count.
create or replace function public.delete_starboard_boost(p_user uuid, p_message bigint)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  delete from starboard_boost b where b.user_id = p_user and b.message_id = p_message;
  select count(*)::int into v_count from starboard_boost b where b.message_id = p_message and b.direction = 'boost';
  update chat_message m set boost_count = v_count where m.id = p_message;
  return v_count;
end; $$;

grant execute on function public.record_starboard_boost(uuid, bigint, text) to authenticated, service_role;
grant execute on function public.delete_starboard_boost(uuid, bigint) to authenticated, service_role;
