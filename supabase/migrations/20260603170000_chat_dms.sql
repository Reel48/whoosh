-- Direct messages, modeled as private channels (no threads).
--
-- A DM is a `chat_channel` with kind='dm', no category, and a row per participant
-- in `chat_channel_member`. Messages/reactions/read-state/Realtime all reuse the
-- channel machinery unchanged — the only new access rule is "DM ⇒ members only",
-- folded into `chat_can_read` so every existing gate (RLS, RPCs) covers DMs too.

-- DMs have no category, and 'dm' is a new channel kind.
alter table public.chat_channel alter column category_id drop not null;
alter table public.chat_channel drop constraint if exists chat_channel_kind_check;
alter table public.chat_channel add constraint chat_channel_kind_check
  check (kind in ('text','media','leaderboard','starboard','dm'));

create table if not exists public.chat_channel_member (
  channel_id bigint not null references public.chat_channel(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists chat_channel_member_user_idx on public.chat_channel_member (user_id);

alter table public.chat_channel_member enable row level security;
create policy chat_channel_member_read on public.chat_channel_member for select to authenticated
  using (user_id = auth.uid() or public.chat_can_read(channel_id, auth.uid()));

-- A DM is readable only by its members; non-DM channels keep the role/admin rule.
create or replace function public.chat_can_read(p_channel bigint, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_required bigint;
  v_active   boolean;
  v_kind     text;
begin
  if p_user is null then return false; end if;
  select required_role_id, is_active, kind into v_required, v_active, v_kind
    from chat_channel where id = p_channel;
  if not found or not v_active then return false; end if;
  if v_kind = 'dm' then
    return exists (select 1 from chat_channel_member where channel_id = p_channel and user_id = p_user);
  end if;
  if v_required is null then return true; end if;
  if exists (select 1 from profile where user_id = p_user and is_admin) then return true; end if;
  return exists (select 1 from chat_user_role where user_id = p_user and role_id = v_required);
end;
$$;

-- Find the 1:1 DM for {p_user, p_other}, creating it if absent. Slug is the
-- sorted uuid pair, so the channel is deduplicated naturally.
create or replace function public.get_or_create_dm(p_user uuid, p_other uuid)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_slug text; v_id bigint;
begin
  if p_user = p_other then raise exception 'validation: cannot dm yourself'; end if;
  if not exists (select 1 from profile where user_id = p_other) then raise exception 'not_found'; end if;
  v_slug := 'dm:' || least(p_user, p_other)::text || ':' || greatest(p_user, p_other)::text;
  select id into v_id from chat_channel where slug = v_slug;
  if v_id is null then
    insert into chat_channel (category_id, slug, name, kind, post_policy, required_role_id)
    values (null, v_slug, 'Direct Message', 'dm', 'members', null)
    on conflict (slug) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from chat_channel where slug = v_slug; end if;
    insert into chat_channel_member (channel_id, user_id)
    values (v_id, p_user), (v_id, p_other) on conflict do nothing;
  end if;
  return v_id;
end;
$$;
