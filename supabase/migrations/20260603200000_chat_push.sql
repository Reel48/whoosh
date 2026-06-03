-- APNs push for chat notifications (Phase 6b).
--
-- Device tokens per user + an AFTER INSERT trigger on `notification` that, for
-- chat kinds, fires the `push-apns` Edge Function (async, via pg_net). The
-- function signs an APNs JWT from the .p8 key (held in Edge Function secrets) and
-- pushes to every registered device. The trigger authenticates to the function
-- with the service-role key stored in Vault — until that secret exists, the
-- trigger is a safe no-op (in-app notifications still work regardless).

create table if not exists public.device_token (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'ios' check (platform in ('ios')),
  updated_at timestamptz not null default now()
);
create index if not exists device_token_user_idx on public.device_token (user_id);

alter table public.device_token enable row level security;
create policy device_token_read_self on public.device_token for select to authenticated
  using (user_id = auth.uid());
-- Writes go through the api (service-role); no write policy needed.

-- The trigger authenticates to the (verify_jwt=false) Edge Function with a shared
-- secret stored in Vault as `push_webhook_secret` (no Supabase master key handled).
-- Set it once with:
--   select vault.create_secret('<random>', 'push_webhook_secret');
-- and the same value as the function's WEBHOOK_SECRET. Until then this is a no-op.
create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_secret text;
  v_url text := 'https://yjmohosxtemjamwrsffw.supabase.co/functions/v1/push-apns';
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  if v_secret is null then return new; end if;  -- not configured yet → no-op
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_push on public.notification;
create trigger trg_notify_push
  after insert on public.notification
  for each row when (new.kind in ('chat_mention', 'chat_dm'))
  execute function public.notify_push_on_notification();
