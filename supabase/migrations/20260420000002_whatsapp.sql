-- 0015_whatsapp.sql
-- WhatsApp Business API integration: opt-in prefs, message log, helper fn.
--
-- DOWN (manual):
--   drop table if exists public.whatsapp_messages;
--   alter table public.profiles drop column if exists notification_prefs;

-- profiles.notification_prefs (jsonb) ---------------------------------------
-- Keys we use:
--   whatsapp_opt_in      boolean  (default true — can STOP)
--   daily_summary_opt_in boolean  (default false — opt-in only)
--   auto_reconnect       boolean  (default true — STOP command flips off)
--   welcomed_at          timestamptz (first welcome sent)
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_prefs is
  'Neighbor notification preferences. Keys: whatsapp_opt_in, daily_summary_opt_in, auto_reconnect, welcomed_at.';

-- whatsapp_messages: inbound + outbound log for debugging and admin UI ------
create table if not exists public.whatsapp_messages (
  id bigserial primary key,
  direction text not null check (direction in ('inbound', 'outbound')),
  user_id uuid references public.profiles(id) on delete set null,
  phone text not null,
  wa_message_id text,
  command text,
  body text,
  status text not null default 'received'
    check (status in ('received', 'processed', 'sent', 'failed', 'fell_back_to_sms')),
  error text,
  provider text not null default 'whatsapp_cloud',
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_user_idx
  on public.whatsapp_messages (user_id);
create index if not exists whatsapp_messages_phone_idx
  on public.whatsapp_messages (phone);
create index if not exists whatsapp_messages_created_idx
  on public.whatsapp_messages (created_at desc);
create unique index if not exists whatsapp_messages_wa_id_uniq
  on public.whatsapp_messages (wa_message_id)
  where wa_message_id is not null;

alter table public.whatsapp_messages enable row level security;

create policy "whatsapp_messages: admin read"
  on public.whatsapp_messages
  for select
  using (public.is_admin());

create policy "whatsapp_messages: self read"
  on public.whatsapp_messages
  for select
  using (user_id = auth.uid());

comment on table public.whatsapp_messages is
  'Append-only log of WhatsApp messages in both directions. wa_message_id is the Meta message id (unique) for idempotent inbound handling.';

-- Helper: look up an active connection for a neighbor (by phone or user_id).
-- Used by command handlers to compute balance / price. SECURITY DEFINER to
-- let the webhook (authenticated as nobody) resolve neighbors by phone.
create or replace function public.whatsapp_resolve_neighbor(p_phone text)
returns table (
  user_id uuid,
  full_name text,
  wallet_id uuid,
  balance_kobo numeric,
  connection_id uuid,
  host_id uuid,
  host_name text,
  current_price_per_kwh numeric,
  notification_prefs jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.full_name,
    w.id as wallet_id,
    w.balance as balance_kobo,
    c.id as connection_id,
    c.host_id,
    hp.full_name as host_name,
    c.current_price_per_kwh,
    p.notification_prefs
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  left join public.connections c
    on c.neighbor_id = p.id and c.status = 'active'
  left join public.profiles hp on hp.id = c.host_id
  where p.phone = p_phone
  order by c.created_at desc nulls last
  limit 1;
$$;

grant execute on function public.whatsapp_resolve_neighbor(text) to service_role;
