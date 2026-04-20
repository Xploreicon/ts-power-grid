-- ============================================================================
-- 0003_sites_gateways_meters.sql
-- Physical install records: a site hosts a gateway, which bridges one or more meters.
--
-- ROLLBACK:
--   drop table if exists public.meters cascade;
--   drop table if exists public.gateways cascade;
--   drop table if exists public.sites cascade;
-- ============================================================================

-- sites ----------------------------------------------------------------------
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  address text not null,
  lagos_area text,
  coordinates point,
  installation_type public.installation_type not null,
  solar_capacity_kw numeric(8, 2) not null,
  battery_capacity_kwh numeric(8, 2) not null,
  installed_at timestamptz,
  status public.site_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sites_host_id_idx on public.sites (host_id);
create index sites_status_idx on public.sites (status);

comment on column public.sites.coordinates is 'Postgres point(lon, lat). Swap to PostGIS geography if geo queries are added.';

-- gateways -------------------------------------------------------------------
create table public.gateways (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.sites(id) on delete cascade,
  serial_number text not null unique,
  hardware_version text,
  firmware_version text,
  last_seen_at timestamptz,
  status public.gateway_status not null default 'provisioned',
  cert_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gateways_status_idx on public.gateways (status);
create index gateways_last_seen_at_idx on public.gateways (last_seen_at desc);

-- meters ---------------------------------------------------------------------
create table public.meters (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null references public.gateways(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  serial_number text not null unique,
  meter_type public.meter_type not null,
  installed_at timestamptz,
  status public.meter_status not null default 'active',
  last_reading_kwh numeric(12, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meters_gateway_id_idx on public.meters (gateway_id);
create index meters_user_id_idx on public.meters (user_id);
create index meters_status_idx on public.meters (status);
