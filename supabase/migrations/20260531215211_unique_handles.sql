-- Unique, editable handles + a has_password flag.
--
-- profile.username becomes the user's globally-unique @handle (case-insensitive):
-- shown on leaderboards and used to address WB transfers. We also track whether
-- the account has a password set (gotrue doesn't expose this), so the account
-- UI can show whether email+password login is enabled.

-- ---------------------------------------------------------------------------
-- normalize_handle: lowercase, collapse whitespace/dots/dashes to underscore,
-- strip anything outside [a-z0-9_], cap at 20 chars. May return < 3 chars or
-- empty — callers pad/uniquify.
-- ---------------------------------------------------------------------------
create or replace function normalize_handle(input text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[[:space:].\-]+', '_', 'g'),
      '[^a-z0-9_]', '', 'g'
    ),
    20
  );
$$;

-- ---------------------------------------------------------------------------
-- One-time: normalize existing profile.username into valid, unique handles.
-- Pads handles shorter than 3 chars and resolves collisions by suffixing.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in select user_id, username from profile order by created_at, user_id loop
    base := normalize_handle(r.username);
    if length(base) < 3 then
      base := left(base || substr(replace(r.user_id::text, '-', ''), 1, 6), 20);
    end if;
    cand := base;
    n := 0;
    while exists (
      select 1 from profile p
      where lower(p.username) = lower(cand) and p.user_id <> r.user_id
    ) loop
      n := n + 1;
      cand := left(base, 19 - length(n::text)) || '_' || n::text;
    end loop;
    if cand <> r.username then
      update profile set username = cand where user_id = r.user_id;
    end if;
  end loop;
end $$;

-- Format + uniqueness. Case-insensitive unique so @Mason and @mason can't coexist.
alter table profile
  add constraint profile_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$');

create unique index profile_username_lower_idx on profile (lower(username));

-- ---------------------------------------------------------------------------
-- Track whether the account can log in with email + password.
-- Backfill: any user that already has an 'email' identity has a password.
-- ---------------------------------------------------------------------------
alter table profile add column has_password boolean not null default false;

update profile p
set has_password = true
where exists (
  select 1 from auth.identities i
  where i.user_id = p.user_id and i.provider = 'email'
);

-- ---------------------------------------------------------------------------
-- Rewrite the signup seed trigger to mint a guaranteed-unique handle and record
-- has_password. CRITICAL: this runs inside the auth.users INSERT — it must never
-- raise (a unique-violation here would break signup), so collisions fall back to
-- a uuid-suffixed handle.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  raw_name text;
  base text;
  cand text;
  n int := 0;
  derived_discord text;
  is_email_signup boolean;
begin
  raw_name := coalesce(
    nullif(meta->>'global_name', ''),
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(meta->>'user_name', ''),
    nullif(meta->>'preferred_username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'whoosh'
  );

  base := normalize_handle(raw_name);
  -- Pad short/empty handles with uuid entropy so they're valid and ~unique.
  if length(base) < 3 then
    base := left(base || substr(replace(new.id::text, '-', ''), 1, 6), 20);
  end if;

  cand := base;
  -- Bounded collision resolution; the uuid-suffix fallback guarantees success.
  while exists (select 1 from profile p where lower(p.username) = lower(cand)) loop
    n := n + 1;
    if n <= 5 then
      cand := left(base, 19 - length(n::text)) || '_' || n::text;
    else
      cand := left(base, 11) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
      exit;
    end if;
  end loop;

  -- Discord OAuth puts the snowflake in provider_id (and sub).
  if (app_meta->>'provider' = 'discord') or (app_meta->'providers' ? 'discord') then
    derived_discord := coalesce(nullif(meta->>'provider_id', ''), nullif(meta->>'sub', ''));
  end if;

  is_email_signup := (app_meta->>'provider' = 'email');

  insert into profile (user_id, username, avatar_url, discord_user_id, has_password)
  values (
    new.id,
    cand,
    nullif(coalesce(meta->>'avatar_url', meta->>'picture'), ''),
    derived_discord,
    is_email_signup
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
