-- ============================================================================
-- seed.sql — runs after migrations via `supabase db reset`.
-- Creates 1 super_admin, 1 sample host site with 3 neighbors, and 3 raw leads.
-- Fixed UUIDs so re-running the seed is deterministic during local dev.
-- ============================================================================

-- Users (auth.users) ---------------------------------------------------------
-- Supabase accepts direct inserts into auth.users when run with the service role
-- (which `supabase db reset` uses). Password for admin: "changeme".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated',
   'admin@tspowergrid.com', crypt('changeme', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated',
   'tunde.test@example.com', crypt('changeme', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333331',
   'authenticated', 'authenticated',
   'chika.test@example.com', crypt('changeme', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333332',
   'authenticated', 'authenticated',
   'amaka.test@example.com', crypt('changeme', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated',
   'bayo.test@example.com', crypt('changeme', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   '', '', '', '')
on conflict (id) do nothing;

-- Profiles (wallets auto-created via on_profile_created trigger) -------------
insert into public.profiles (id, role, phone, full_name, email, kyc_status) values
  ('11111111-1111-1111-1111-111111111111', 'super_admin', '+2348100000000', 'T&S Admin',   'admin@tspowergrid.com',    'verified'),
  ('22222222-2222-2222-2222-222222222222', 'host',        '+2348100000001', 'Tunde Test',  'tunde.test@example.com',   'verified'),
  ('33333333-3333-3333-3333-333333333331', 'neighbor',    '+2348100000011', 'Chika Test',  'chika.test@example.com',   'verified'),
  ('33333333-3333-3333-3333-333333333332', 'neighbor',    '+2348100000012', 'Amaka Test',  'amaka.test@example.com',   'verified'),
  ('33333333-3333-3333-3333-333333333333', 'neighbor',    '+2348100000013', 'Bayo Test',   'bayo.test@example.com',    'verified')
on conflict (id) do nothing;

-- Give the neighbors some starting balance (₦5,000 = 500,000 kobo) for testing.
update public.wallets set balance = 500000
  where user_id in (
    '33333333-3333-3333-3333-333333333331',
    '33333333-3333-3333-3333-333333333332',
    '33333333-3333-3333-3333-333333333333'
  );

-- Site + gateway + meters ----------------------------------------------------
insert into public.sites (id, host_id, address, lagos_area, installation_type,
                          solar_capacity_kw, battery_capacity_kwh, installed_at, status)
values
  ('aaaa1111-aaaa-1111-aaaa-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '12 Admiralty Way, Lekki Phase 1', 'Lekki', 'full_stack',
   8.0, 10.0, now() - interval '14 days', 'active')
on conflict (id) do nothing;

insert into public.gateways (id, site_id, serial_number, hardware_version,
                             firmware_version, last_seen_at, status)
values
  ('bbbb1111-bbbb-1111-bbbb-111111111111',
   'aaaa1111-aaaa-1111-aaaa-111111111111',
   'TS-GW-000001', 'v1.0', 'fw-1.2.3', now(), 'online')
on conflict (id) do nothing;

-- One host meter + three neighbor meters on the same gateway.
insert into public.meters (id, gateway_id, user_id, serial_number, meter_type,
                           installed_at, status, last_reading_kwh) values
  ('cccc1111-cccc-1111-cccc-000000000001',
   'bbbb1111-bbbb-1111-bbbb-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'TS-MT-HOST-01', 'host',     now() - interval '14 days', 'active', 1240.500),
  ('cccc1111-cccc-1111-cccc-000000000002',
   'bbbb1111-bbbb-1111-bbbb-111111111111',
   '33333333-3333-3333-3333-333333333331',
   'TS-MT-NBR-01',  'neighbor', now() - interval '10 days', 'active',   42.250),
  ('cccc1111-cccc-1111-cccc-000000000003',
   'bbbb1111-bbbb-1111-bbbb-111111111111',
   '33333333-3333-3333-3333-333333333332',
   'TS-MT-NBR-02',  'neighbor', now() - interval '9 days',  'active',   18.000),
  ('cccc1111-cccc-1111-cccc-000000000004',
   'bbbb1111-bbbb-1111-bbbb-111111111111',
   '33333333-3333-3333-3333-333333333333',
   'TS-MT-NBR-03',  'neighbor', now() - interval '7 days',  'active',    5.750)
on conflict (id) do nothing;

-- Connections ----------------------------------------------------------------
insert into public.connections (id, host_id, neighbor_id, meter_id,
                                current_price_per_kwh, status, started_at) values
  ('dddd1111-dddd-1111-dddd-000000000001',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333331',
   'cccc1111-cccc-1111-cccc-000000000002',
   280.00, 'active', now() - interval '10 days'),
  ('dddd1111-dddd-1111-dddd-000000000002',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333332',
   'cccc1111-cccc-1111-cccc-000000000003',
   280.00, 'active', now() - interval '9 days'),
  ('dddd1111-dddd-1111-dddd-000000000003',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   'cccc1111-cccc-1111-cccc-000000000004',
   280.00, 'active', now() - interval '7 days')
on conflict (id) do nothing;

-- Sample leads ---------------------------------------------------------------
insert into public.leads (name, phone, email, address, lagos_area, path_interest, status) values
  ('Ifeoma Obi',   '+2348022223330', 'ifeoma.obi@example.com',    '5 Fola Osibo, Lekki',         'Lekki',           'full_stack', 'new'),
  ('Kemi Adebayo', '+2348034445551', 'kemi.adebayo@example.com',  '22 Ligali Ayorinde, VI',      'Victoria Island', 'upgrade',    'contacted'),
  ('Femi Okafor',  '+2348056667772', 'femi.okafor@example.com',   '14 Allen Avenue, Ikeja',      'Ikeja',           'either',     'new')
on conflict do nothing;
