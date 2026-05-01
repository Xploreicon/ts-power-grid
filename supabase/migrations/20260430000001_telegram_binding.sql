-- Telegram bot binding.
--
-- Each profile may have a Telegram chat_id once the user has shared
-- their phone with our bot. We key off chat_id (bigint, ~64-bit) on
-- inbound webhook events to resolve the sender to a profile.
--
-- The bind is one-to-one: a phone can only be linked to one chat_id at
-- a time. If the user re-binds from a new chat (e.g. switched phones,
-- new Telegram account on the same SIM), the old binding is replaced.
--
-- We deliberately do NOT add a separate `telegram_bindings` table —
-- the binding is part of the profile's identity surface, same as
-- their phone. RLS on `profiles` already protects it.

alter table public.profiles
    add column if not exists telegram_chat_id bigint;

create unique index if not exists profiles_telegram_chat_id_key
    on public.profiles (telegram_chat_id)
    where telegram_chat_id is not null;

-- ---------------------------------------------------------------------------
-- bind_telegram_chat(phone, chat_id)
--
-- Service-role-only RPC. Looks up the profile by phone (E.164), sets
-- telegram_chat_id, and clears any stale binding on a different
-- profile that was using the same chat_id (defensive — the unique
-- index would otherwise raise).
--
-- Returns the bound profile_id, or null if the phone wasn't found.
-- ---------------------------------------------------------------------------
create or replace function public.bind_telegram_chat(
    p_phone text,
    p_chat_id bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile_id uuid;
begin
    -- Free up the chat_id if it was previously bound to a different
    -- profile (rebind scenario).
    update public.profiles
       set telegram_chat_id = null
     where telegram_chat_id = p_chat_id;

    update public.profiles
       set telegram_chat_id = p_chat_id
     where phone = p_phone
     returning id into v_profile_id;

    return v_profile_id;
end;
$$;

revoke all on function public.bind_telegram_chat(text, bigint) from public, anon, authenticated;
grant execute on function public.bind_telegram_chat(text, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- resolve_telegram_chat(chat_id)
--
-- Inverse of bind. Returns the profile's E.164 phone so the existing
-- whatsapp_resolve_neighbor RPC can do the heavy lifting of resolving
-- profile + wallet + active connection.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_telegram_chat(
    p_chat_id bigint
) returns text
language sql
security definer
set search_path = public
as $$
    select phone
      from public.profiles
     where telegram_chat_id = p_chat_id
     limit 1;
$$;

revoke all on function public.resolve_telegram_chat(bigint) from public, anon, authenticated;
grant execute on function public.resolve_telegram_chat(bigint) to service_role;

comment on column public.profiles.telegram_chat_id is
    'Telegram chat_id once the user has shared their phone via the @ts_powergrid_bot. NULL until binding completes.';
