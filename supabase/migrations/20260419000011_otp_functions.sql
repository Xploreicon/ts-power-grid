-- ============================================================================
-- 0011_otp_functions.sql
-- SQL helpers for OTP operations. Kept separate from 0009 so the approved
-- schema stays untouched. All functions run as SECURITY DEFINER so the
-- Node helpers in lib/auth/otp.ts can call them with the service-role key.
--
-- ROLLBACK:
--   drop function if exists public.get_auth_user_id_by_email(text);
--   drop function if exists public.otp_challenge_count_recent(text, int);
--   drop function if exists public.verify_otp_challenge(uuid, text);
--   drop function if exists public.create_otp_challenge(text, text, int);
-- ============================================================================

-- Insert a new challenge; returns its id (which doubles as the opaque otpToken).
create or replace function public.create_otp_challenge(
  p_phone text,
  p_code text,
  p_ttl_minutes int default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.otp_challenges (phone, code_hash, expires_at)
  values (
    p_phone,
    crypt(p_code, gen_salt('bf', 6)),
    now() + make_interval(mins => p_ttl_minutes)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Verify a challenge. Consumes the row regardless of match to block brute force
-- (a wrong code burns the OTP; user must request a new one).
create or replace function public.verify_otp_challenge(
  p_id uuid,
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match boolean;
begin
  select (
    consumed_at is null
    and expires_at > now()
    and code_hash = crypt(p_code, code_hash)
  )
  into v_match
  from public.otp_challenges
  where id = p_id
  for update;

  update public.otp_challenges
     set consumed_at = now()
   where id = p_id and consumed_at is null;

  return coalesce(v_match, false);
end;
$$;

-- Count recent challenges for rate-limiting.
create or replace function public.otp_challenge_count_recent(
  p_phone text,
  p_minutes int default 15
)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
    from public.otp_challenges
   where phone = p_phone
     and created_at > now() - make_interval(mins => p_minutes);
$$;

-- Look up an auth.users row by email (service-role use only, via rpc).
create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where email = p_email limit 1;
$$;
