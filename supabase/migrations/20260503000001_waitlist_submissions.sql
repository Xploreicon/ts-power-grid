-- 20260503000001_waitlist_submissions.sql
-- Detailed waitlist capture for public launch (separate from quick-capture `leads` table).
--
-- ROLLBACK:
--   drop table if exists public.waitlist_submissions cascade;
--   drop type if exists public.waitlist_status cascade;
-- ============================================================================

-- status enum ----------------------------------------------------------------
create type public.waitlist_status as enum (
  'pending',
  'contacted',
  'qualified',
  'converted',
  'rejected'
);

-- table ----------------------------------------------------------------------
create table public.waitlist_submissions (
  id                   uuid            primary key default gen_random_uuid(),
  created_at           timestamptz     not null default now(),
  status               public.waitlist_status not null default 'pending',

  -- contact
  full_name            text            not null,
  phone                text            not null,
  email                text,
  whatsapp             text,

  -- property
  address              text            not null,
  lga                  text            not null,
  property_type        text,
  ownership            text,
  neighbor_count       text,
  rooftop_access       text,

  -- path
  path                 text            not null,           -- 'upgrade_kit' | 'full_stack'

  -- existing solar (upgrade path only)
  panel_capacity       text,
  inverter_model       text,
  battery_type         text,
  system_age           text,
  surplus_power        text,

  -- power situation
  monthly_power_spend  text            not null,
  primary_power_source text,

  -- investment readiness
  payment_preference   text,
  timeline             text,
  target_price_per_kwh text,
  drone_assessment     text,
  referral_source      text,
  notes                text
);

comment on table public.waitlist_submissions is
  'Detailed public waitlist for launch. Separate from quick-capture leads.';

-- indexes --------------------------------------------------------------------
create index waitlist_status_created_idx
  on public.waitlist_submissions (status, created_at desc);

create index waitlist_path_idx
  on public.waitlist_submissions (path);

create index waitlist_lga_idx
  on public.waitlist_submissions (lga);

-- RLS ------------------------------------------------------------------------
alter table public.waitlist_submissions enable row level security;

-- Anyone can submit (anon insert via public API route).
create policy "waitlist: public insert"
  on public.waitlist_submissions
  for insert with check (true);

-- Only admins can read / update / delete.
create policy "waitlist: admin select"
  on public.waitlist_submissions
  for select using (public.is_admin());

create policy "waitlist: admin update"
  on public.waitlist_submissions
  for update using (public.is_admin());

create policy "waitlist: admin delete"
  on public.waitlist_submissions
  for delete using (public.is_admin());
