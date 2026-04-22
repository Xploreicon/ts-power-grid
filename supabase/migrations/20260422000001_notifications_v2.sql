-- ============================================================================
-- 20260422000001_notifications_v2.sql
-- Multi-channel notification infrastructure
-- ============================================================================

-- 1. User preferences (opt-ins per channel per event)
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- 2. Web Push subscriptions (VAPID endpoint + keys)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  auth text not null,
  p256dh text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- 3. Delivery log (for admin reporting and debugging)
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  channel text not null, -- 'in_app', 'push', 'sms', 'whatsapp', 'email'
  status text not null, -- 'delivered', 'failed', 'pending'
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notification_deliveries_user_id_idx on public.notification_deliveries (user_id);
create index notification_deliveries_status_idx on public.notification_deliveries (status);
create index notification_deliveries_created_at_idx on public.notification_deliveries (created_at desc);

-- 4. RLS Policies
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

-- Users can manage their own push subscriptions
create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Deliveries are mostly admin-read-only, but users could theoretically read their own
create policy notification_deliveries_select_own on public.notification_deliveries
  for select using (auth.uid() = user_id);
