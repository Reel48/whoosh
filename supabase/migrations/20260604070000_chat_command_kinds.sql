-- New slash-command message kinds: /score (live game card), /gift (Whoosh Bucks
-- transfer card), /rank (standing card). Extend the kind allowlist; rendering is
-- client-side off chat_message.data, like the other structured kinds.
alter table public.chat_message drop constraint if exists chat_message_kind_check;
alter table public.chat_message
  add constraint chat_message_kind_check
  check (kind in ('text','image','gif','spoiler','stock','bet','poll','file','welcome','score','gift','rank'));
