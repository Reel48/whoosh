-- Chat Phase 0 hardening:
--  1. Reaction emoji validation — `toggle_chat_reaction` stored whatever string the
--     client sent as `emoji` (no bound) and broadcast it to every subscriber. Cap it
--     to a sane emoji-sized token so it can't be abused to broadcast arbitrary text.
--  2. Delete privacy — soft-delete only set `deleted_at`; with `replica identity full`
--     the Realtime UPDATE payload still carried the original `body`/`image_url`, and the
--     content lingered in the row. Blank both on delete so deleted content can't leak.

-- ── 1. Reaction emoji validation ─────────────────────────────────────────────
create or replace function public.toggle_chat_reaction(
  p_user uuid,
  p_message bigint,
  p_emoji text,
  p_on boolean
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel bigint;
  v_count   integer;
  v_emoji   text := btrim(coalesce(p_emoji, ''));
begin
  -- Emoji are short: a handful of code points even for ZWJ sequences/flags.
  -- Reject empty and anything longer than a generous emoji bound — this is a
  -- reaction token, not free text.
  if v_emoji = '' or char_length(v_emoji) > 16 or octet_length(v_emoji) > 64 then
    raise exception 'validation: invalid emoji';
  end if;

  select channel_id into v_channel from chat_message where id = p_message and deleted_at is null;
  if not found or not chat_can_read(v_channel, p_user) then raise exception 'forbidden'; end if;

  if p_on then
    insert into chat_reaction (message_id, user_id, emoji, channel_id)
    values (p_message, p_user, v_emoji, v_channel) on conflict do nothing;
  else
    delete from chat_reaction where message_id = p_message and user_id = p_user and emoji = v_emoji;
  end if;

  update chat_message
     set star_count = (select count(*) from chat_reaction where message_id = p_message and emoji = '⭐')
   where id = p_message
   returning star_count into v_count;
  return v_count;
end;
$$;

-- ── 2. Delete privacy: blank content on soft-delete ──────────────────────────
create or replace function public.delete_chat_message(p_user uuid, p_message bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_is_admin boolean;
begin
  select coalesce((select is_admin from profile where user_id = p_user), false) into v_is_admin;
  update chat_message
     set deleted_at = now(), body = '', image_url = null
   where id = p_message and deleted_at is null and (user_id = p_user or v_is_admin);
  if not found then raise exception 'forbidden'; end if;
end;
$$;
