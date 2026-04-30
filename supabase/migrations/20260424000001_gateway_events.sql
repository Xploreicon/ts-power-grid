-- 0014_gateway_events.sql
-- Append-only log of events emitted by gateways (tamper, fault, offline,
-- command_ack, reboot, etc). Feeds the admin fleet detail page.
-- Rollback:
--   drop table if exists public.gateway_events;

create table if not exists public.gateway_events (
  id bigserial primary key,
  gateway_id uuid not null references public.gateways(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gateway_events_gateway_id_idx
  on public.gateway_events (gateway_id, created_at desc);
create index if not exists gateway_events_event_type_idx
  on public.gateway_events (event_type);
create index if not exists gateway_events_severity_idx
  on public.gateway_events (severity)
  where severity in ('warning', 'error', 'critical');

comment on table public.gateway_events is
  'Append-only log of gateway-emitted events (tamper, fault, offline, command_ack, etc).';

-- RLS — service role only. Admin UI reads via service-role client.
alter table public.gateway_events enable row level security;
