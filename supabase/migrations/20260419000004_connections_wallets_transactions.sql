-- ============================================================================
-- 0004_connections_wallets_transactions.sql
-- Host-neighbor connections, wallets, transaction ledger.
--
-- Money is stored in KOBO (1 NGN = 100 kobo) to avoid float rounding.
--
-- ROLLBACK:
--   drop table if exists public.transactions cascade;
--   drop table if exists public.wallets cascade;
--   drop table if exists public.connections cascade;
-- ============================================================================

-- connections ----------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  neighbor_id uuid not null references public.profiles(id) on delete restrict,
  meter_id uuid not null unique references public.meters(id) on delete restrict,
  current_price_per_kwh numeric(8, 2) not null,
  status public.connection_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_host_neighbor_distinct check (host_id <> neighbor_id)
);

create index connections_host_id_idx on public.connections (host_id);
create index connections_neighbor_id_idx on public.connections (neighbor_id);
create index connections_status_idx on public.connections (status);

comment on column public.connections.current_price_per_kwh is 'Price in NGN per kWh (e.g. 280.00). Kobo conversion happens at charge time.';

-- wallets --------------------------------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(18, 0) not null default 0,
  updated_at timestamptz not null default now(),
  constraint wallets_balance_nonneg check (balance >= 0)
);

create index wallets_user_id_idx on public.wallets (user_id);

comment on column public.wallets.balance is 'Balance in KOBO. Always non-negative (enforced by check constraint).';

-- transactions ---------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  type public.transaction_type not null,
  amount numeric(18, 0) not null,
  reference text unique,
  connection_id uuid references public.connections(id) on delete set null,
  kwh_consumed numeric(12, 3),
  metadata jsonb not null default '{}'::jsonb,
  status public.transaction_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index transactions_wallet_id_idx on public.transactions (wallet_id);
create index transactions_connection_id_idx on public.transactions (connection_id);
create index transactions_created_at_idx on public.transactions (created_at desc);
create index transactions_status_idx on public.transactions (status);

comment on column public.transactions.amount is
  'Signed kobo amount. Positive = credit to wallet, negative = debit. Consumption/withdrawal/platform_fee are negative; topup/refund are positive.';
