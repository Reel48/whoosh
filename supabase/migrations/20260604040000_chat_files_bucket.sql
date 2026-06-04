-- Public bucket for chat file attachments (PDF, Excel, Word, etc.). Mirrors the
-- chat-images bucket: public read, uploads go through the service-role client so
-- no storage RLS policy is needed. Type/size are enforced in the API route.
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;
