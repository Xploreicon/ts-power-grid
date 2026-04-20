-- ============================================================================
-- 0006_installments_disputes_notifications.sql
--
-- ROLLBACK:
--   drop table if exists public.notifications cascade;
--   drop table if exists public.disputes cascade;
--   drop table if exists public.installments cascade;
-- ============================================================================

-- installments ---------------------------------------------------------------
create table public.installments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  total_amount numeric(18, 0) not null,
  installment_number int not null,
  amount numeric(18, 0) not null,
  due_date date not null,
  paid_at timestamptz,
  status public.installment_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint installments_site_number_unique unique (site_id, installment_number)
);

create index installments_site_id_idx on public.installments (site_id);
create index installments_status_idx on public.installments (status);
create index installments_due_date_idx on public.installments (due_date);

comment on column public.installments.total_amount is 'Total loan/install amount in kobo.';
comment on column public.installments.amount is 'This installment amount in kobo.';

-- disputes -------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles(id) on delete restrict,
  connection_id uuid not null references public.connections(id) on delete restrict,
  category public.dispute_category not null,
  description text not null,
  status public.dispute_status not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index disputes_raised_by_idx on public.disputes (raised_by);
create index disputes_connection_id_idx on public.disputes (connection_id);
create index disputes_status_idx on public.disputes (status);

-- notifications --------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
  where read_at is null;
