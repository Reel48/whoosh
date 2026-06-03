-- Chat unread + read receipts.
--
-- Per-(user,channel) high-water mark of the last message the user has seen. The
-- overview uses it to show unread counts; DM "seen" receipts read it back for the
-- other participant. Writes go through `mark_chat_read` (SECURITY DEFINER); the
-- SELECT policy lets a user read their own row (and, for receipts, rows in
-- channels they can read).

create table if not exists public.chat_read_state (
  user_id              uuid   not null references auth.users(id) on delete cascade,
  channel_id           bigint not null references public.chat_channel(id) on delete cascade,
  last_read_message_id bigint not null default 0,
  updated_at           timestamptz not null default now(),
  primary key (user_id, channel_id)
);
create index if not exists chat_read_state_channel_idx on public.chat_read_state (channel_id);

alter table public.chat_read_state enable row level security;

-- A user reads their own state; receipts also need to read other members' state
-- for channels the viewer can read (DMs are 2-person, so this stays tiny).
create policy chat_read_state_read on public.chat_read_state for select to authenticated
  using (user_id = auth.uid() or public.chat_can_read(channel_id, auth.uid()));

-- Advance the high-water mark (never moves backwards). Requires read access.
create or replace function public.mark_chat_read(p_user uuid, p_channel bigint, p_message bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not chat_can_read(p_channel, p_user) then raise exception 'forbidden'; end if;
  insert into chat_read_state (user_id, channel_id, last_read_message_id, updated_at)
  values (p_user, p_channel, greatest(p_message, 0), now())
  on conflict (user_id, channel_id) do update
    set last_read_message_id = greatest(chat_read_state.last_read_message_id, excluded.last_read_message_id),
        updated_at = now();
end;
$$;

-- Per-channel unread count + last activity for every channel the user can read.
-- chat_can_read is evaluated once per active channel (the subquery), not per row.
create or replace function public.chat_unread_counts(p_user uuid)
returns table (channel_id bigint, unread bigint, last_activity timestamptz)
language sql stable security definer set search_path = public
as $$
  select m.channel_id,
         count(*) filter (where m.id > coalesce(rs.last_read_message_id, 0)) as unread,
         max(m.created_at) as last_activity
    from chat_message m
    left join chat_read_state rs
      on rs.channel_id = m.channel_id and rs.user_id = p_user
   where m.deleted_at is null
     and m.channel_id in (
       select c.id from chat_channel c where c.is_active and chat_can_read(c.id, p_user)
     )
   group by m.channel_id;
$$;
