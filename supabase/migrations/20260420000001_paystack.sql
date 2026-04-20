-- 0014_paystack.sql
-- Paystack integration columns + webhook event log.
--
-- DOWN (manual):
--   drop table if exists public.paystack_webhook_events;
--   alter table public.profiles drop column if exists paystack_recipient_code;
--   alter table public.profiles drop column if exists paystack_customer_code;

-- profiles: store Paystack transfer recipient + customer codes --------------
alter table public.profiles
  add column if not exists paystack_recipient_code text,
  add column if not exists paystack_customer_code text;

comment on column public.profiles.paystack_recipient_code is
  'Paystack transfer recipient code (RCP_xxx). Set when host configures bank details.';
comment on column public.profiles.paystack_customer_code is
  'Paystack customer code (CUS_xxx). Set on first successful charge.';

-- paystack_webhook_events: append-only log of every webhook received --------
-- Service-role writes; admins read. Used for replay / debugging / idempotency.
create table if not exists public.paystack_webhook_events (
  id bigserial primary key,
  event_type text not null,
  reference text,
  paystack_id text,
  signature_valid boolean not null,
  processed_at timestamptz,
  processing_error text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists paystack_webhook_events_ref_idx
  on public.paystack_webhook_events (reference);
create index if not exists paystack_webhook_events_event_type_idx
  on public.paystack_webhook_events (event_type);
create index if not exists paystack_webhook_events_received_idx
  on public.paystack_webhook_events (received_at desc);

alter table public.paystack_webhook_events enable row level security;

-- Admins can read; no one writes except service role.
create policy "paystack_webhook_events: admin read"
  on public.paystack_webhook_events
  for select
  using (public.is_admin());

comment on table public.paystack_webhook_events is
  'Append-only log of Paystack webhook deliveries. Used for idempotency and replay.';
