-- ============================================================================
-- 0002_profiles_leads.sql
-- profiles (extends auth.users), leads pipeline.
--
-- ROLLBACK:
--   drop table if exists public.leads cascade;
--   drop table if exists public.profiles cascade;
-- ============================================================================

-- profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'neighbor',
  phone text unique,
  full_name text,
  email text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  kyc_status public.kyc_status not null default 'pending',
  kyc_documents jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_phone_idx on public.profiles (phone);
create index profiles_role_idx on public.profiles (role);

comment on table public.profiles is 'Application-level user profile. 1:1 with auth.users.';
comment on column public.profiles.phone is 'E.164 format, e.g. +2348100000001';

-- leads ----------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  address text,
  lagos_area text,
  path_interest public.path_interest not null default 'either',
  source text not null default 'landing_page',
  status public.lead_status not null default 'new',
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_created_at_idx on public.leads (created_at desc);

comment on table public.leads is 'Lead capture pipeline from marketing site / referrals.';
