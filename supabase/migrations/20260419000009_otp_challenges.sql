-- ============================================================================
-- 0009_otp_challenges.sql
-- Single-use phone OTP challenges. Used by sendPhoneOtp/verifyPhoneOtp helpers.
--
-- Follow-up: schedule stale-row cleanup, e.g.
--   select cron.schedule('otp-cleanup', '0 * * * *',
--     $$delete from public.otp_challenges where created_at < now() - interval '1 day'$$);
--
-- ROLLBACK:
--   drop table if exists public.otp_challenges cascade;
-- ============================================================================

create table public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Supports (a) rate-limit counts in the last 15 min, and
-- (b) fetching the latest unconsumed challenge for a phone on verify.
create index otp_challenges_phone_created_at_idx
  on public.otp_challenges (phone, created_at desc);

comment on table public.otp_challenges is
  'Phone OTP challenges. Row id doubles as the opaque single-use otpToken returned to the client.';
comment on column public.otp_challenges.code_hash is
  'bcrypt of the 6-digit code via crypt(code, gen_salt(''bf'', 6)).';
comment on column public.otp_challenges.phone is 'E.164 format, e.g. +2348100000001.';

-- RLS: service-role only. All access flows through /api/auth/* routes using the
-- service-role key. No policies = all non-service-role access denied.
alter table public.otp_challenges enable row level security;
