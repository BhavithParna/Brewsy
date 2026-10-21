-- Brewsy: the feedback inbox and usage open only on a phone the owner paired in the dashboard.
--
-- Until now the owner's functions trusted devices.is_owner alone. That mark went on every device
-- that existed on 2026-10-20 (20261020000000 took them all to be the owner's), and a device is
-- known only by its id, which the app sends with every request. Now they need an owner key too:
--   1. On the owner's phone: Settings → long-press "Connected to your Brewsy backend" → Get a code.
--      The phone makes a random key, keeps it, and sends only its SHA-256 (brewsy_owner_ask).
--   2. In Supabase → SQL Editor: select private.brewsy_approve_owner('<the code>');
--   3. From then on the phone sends the key (`x-owner-key`) with the owner's calls. The server
--      hashes it and checks it, with the phone's `x-device-id`, against private.owner_keys.
-- Nothing anyone can call with the app's public key adds or approves a key: approving lives in
-- the private schema, which only the dashboard and the server reach. A code waits an hour.
--
-- Approving also leaves the paired phones as the only devices marked is_owner (they time the
-- world edition and get the alerts), which clears the marks on old installs and test devices.
--
-- New:
--   private.owner_keys                 paired (and waiting) owner phones: key hash, device id
--   brewsy_owner_ask(key_hash)         a phone asks to be paired: its code, or 'paired'
--   private.brewsy_approve_owner(code) the owner pairs the phone showing that code (dashboard only)
-- Changed:
--   brewsy_is_owner()                  true only with a paired key from its own phone; the
--                                      brewsy_owner_* functions all go through it
--
-- To unpair every phone: delete from private.owner_keys;
-- Safe to run more than once.

create table if not exists private.owner_keys (
  -- SHA-256 (hex) of the key the phone keeps. The key itself is never stored.
  key_hash    text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  device_id   text not null check (char_length(device_id) between 8 and 128),
  -- Shown on the phone while it waits to be approved; cleared once it is.
  code        text unique,
  asked_at    timestamptz not null default now(),
  approved_at timestamptz
);
revoke all on private.owner_keys from public, anon, authenticated;

-- ─── the phone asks ─────────────────────────────────────────────────────────
create or replace function public.brewsy_owner_ask(p_key_hash text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d text := nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id';
  k private.owner_keys;
  c text;
begin
  if d is null or char_length(d) not between 8 and 128 then return null; end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  -- Only installs the server knows (the app saves its device row first).
  if not exists (select 1 from public.devices where device_id = d) then return null; end if;

  delete from private.owner_keys where approved_at is null and asked_at < now() - interval '1 hour';

  select * into k from private.owner_keys where key_hash = p_key_hash;
  if found then
    if k.device_id <> d then return null; end if;
    if k.approved_at is not null then return 'paired'; end if;
    return k.code;
  end if;

  -- One waiting code per phone, and only so many at once.
  delete from private.owner_keys where approved_at is null and device_id = d;
  if (select count(*) from private.owner_keys where approved_at is null) >= 50 then
    raise exception 'Too many phones are waiting to be paired. Try again in an hour.' using errcode = 'P0001';
  end if;
  c := upper(left(replace(gen_random_uuid()::text, '-', ''), 8));
  insert into private.owner_keys (key_hash, device_id, code) values (p_key_hash, d, c);
  return c;
end;
$$;
revoke execute on function public.brewsy_owner_ask(text) from public;
grant execute on function public.brewsy_owner_ask(text) to anon, authenticated;

-- ─── the owner approves (SQL Editor) ────────────────────────────────────────
create or replace function private.brewsy_approve_owner(p_code text) returns text
language plpgsql
set search_path = ''
as $$
declare
  k private.owner_keys;
begin
  update private.owner_keys
     set approved_at = now(), code = null
   where code = upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'))
     and approved_at is null
     and asked_at > now() - interval '1 hour'
  returning * into k;
  if not found then
    return 'No phone is waiting with that code. On the phone, get a new one.';
  end if;

  update public.devices d
     set is_owner = exists (select 1 from private.owner_keys p
                            where p.approved_at is not null and p.device_id = d.device_id);

  return 'Paired. On the phone, tap Check again.';
end;
$$;
revoke execute on function private.brewsy_approve_owner(text) from public, anon, authenticated;

-- ─── who is the owner ───────────────────────────────────────────────────────
create or replace function public.brewsy_is_owner() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.owner_keys k,
         (select nullif(current_setting('request.headers', true), '')::json as h) r
    where k.approved_at is not null
      and k.device_id = r.h ->> 'x-device-id'
      and k.key_hash = encode(sha256(convert_to(r.h ->> 'x-owner-key', 'UTF8')), 'hex')
  );
$$;
revoke execute on function public.brewsy_is_owner() from public;
grant execute on function public.brewsy_is_owner() to anon, authenticated;
