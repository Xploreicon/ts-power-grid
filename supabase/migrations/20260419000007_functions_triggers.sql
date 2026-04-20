-- ============================================================================
-- 0007_functions_triggers.sql
-- Triggers: updated_at, auto-wallet, auto-notification on transaction success.
-- Functions: process_consumption, top_up_wallet, initiate_withdrawal, connect_neighbor.
--
-- ROLLBACK:
--   drop function if exists public.connect_neighbor(uuid, text, numeric);
--   drop function if exists public.initiate_withdrawal(uuid, numeric);
--   drop function if exists public.top_up_wallet(uuid, numeric, text);
--   drop function if exists public.process_consumption(uuid, numeric);
--   drop function if exists public.is_admin();
--   drop function if exists public.handle_transaction_notification() cascade;
--   drop function if exists public.handle_new_profile() cascade;
--   drop function if exists public.handle_updated_at() cascade;
-- ============================================================================

-- updated_at auto-bump -------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'updated_at'
      and not a.attisdropped
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.handle_updated_at();',
      r.table_name
    );
  end loop;
end;
$$;

-- Auto-create profile + wallet when an auth user is created ------------------
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Role check helper (used by RLS) -------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

-- Auto-notify user on transaction success ------------------------------------
create or replace function public.handle_transaction_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_title text;
  v_body text;
begin
  if new.status <> 'success' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'success' then
    return new; -- already notified on first success
  end if;

  select user_id into v_user_id from public.wallets where id = new.wallet_id;
  if v_user_id is null then
    return new;
  end if;

  v_title := case new.type
    when 'topup'        then 'Wallet topped up'
    when 'consumption'  then case when new.amount >= 0 then 'Earnings received' else 'Power consumed' end
    when 'withdrawal'   then 'Withdrawal processed'
    when 'platform_fee' then 'Platform fee'
    when 'installment'  then 'Installment payment'
    when 'refund'       then 'Refund credited'
  end;

  v_body := format('Amount: ₦%s', to_char(abs(new.amount) / 100.0, 'FM999G999G990D00'));

  insert into public.notifications (user_id, type, title, body, data)
  values (v_user_id, 'transaction', v_title, v_body,
          jsonb_build_object('transaction_id', new.id, 'amount_kobo', new.amount));
  return new;
end;
$$;

create trigger on_transaction_success
  after insert or update of status on public.transactions
  for each row execute function public.handle_transaction_notification();

-- process_consumption --------------------------------------------------------
-- Charges the neighbor for kWh consumed on the meter, credits host minus platform fee,
-- emits ledger transactions on both wallets. Returns neighbor's new balance in kobo.
create or replace function public.process_consumption(
  p_meter_id uuid,
  p_kwh_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conn record;
  v_host_wallet uuid;
  v_neighbor_wallet uuid;
  v_amount_kobo numeric;
  v_fee_kobo numeric;
  v_host_earn_kobo numeric;
  v_platform_fee_rate numeric := 0.10;
  v_new_balance numeric;
begin
  if p_kwh_delta is null or p_kwh_delta <= 0 then
    raise exception 'p_kwh_delta must be positive, got %', p_kwh_delta;
  end if;

  select * into v_conn
  from public.connections
  where meter_id = p_meter_id and status = 'active'
  limit 1;

  if v_conn.id is null then
    raise exception 'No active connection for meter %', p_meter_id;
  end if;

  v_amount_kobo := round(p_kwh_delta * v_conn.current_price_per_kwh * 100);
  v_fee_kobo := round(v_amount_kobo * v_platform_fee_rate);
  v_host_earn_kobo := v_amount_kobo - v_fee_kobo;

  select id into v_neighbor_wallet from public.wallets where user_id = v_conn.neighbor_id for update;
  select id into v_host_wallet     from public.wallets where user_id = v_conn.host_id     for update;

  if v_neighbor_wallet is null then
    raise exception 'Neighbor wallet missing for user %', v_conn.neighbor_id;
  end if;
  if v_host_wallet is null then
    raise exception 'Host wallet missing for user %', v_conn.host_id;
  end if;

  -- Debit neighbor (fail if it would go negative via check constraint).
  update public.wallets
     set balance = balance - v_amount_kobo, updated_at = now()
   where id = v_neighbor_wallet
  returning balance into v_new_balance;

  insert into public.transactions
    (wallet_id, type, amount, connection_id, kwh_consumed, status, metadata)
  values
    (v_neighbor_wallet, 'consumption', -v_amount_kobo, v_conn.id, p_kwh_delta, 'success',
     jsonb_build_object('price_per_kwh', v_conn.current_price_per_kwh,
                        'platform_fee_kobo', v_fee_kobo));

  -- Credit host (net of platform fee).
  update public.wallets
     set balance = balance + v_host_earn_kobo, updated_at = now()
   where id = v_host_wallet;

  insert into public.transactions
    (wallet_id, type, amount, connection_id, kwh_consumed, status, metadata)
  values
    (v_host_wallet, 'consumption', v_host_earn_kobo, v_conn.id, p_kwh_delta, 'success',
     jsonb_build_object('gross_kobo', v_amount_kobo, 'platform_fee_kobo', v_fee_kobo));

  return v_new_balance;
end;
$$;

-- top_up_wallet --------------------------------------------------------------
create or replace function public.top_up_wallet(
  p_user_id uuid,
  p_amount_kobo numeric,
  p_reference text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'p_amount_kobo must be positive';
  end if;

  select id into v_wallet_id from public.wallets where user_id = p_user_id for update;
  if v_wallet_id is null then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  update public.wallets
     set balance = balance + p_amount_kobo, updated_at = now()
   where id = v_wallet_id
  returning balance into v_new_balance;

  insert into public.transactions (wallet_id, type, amount, reference, status)
  values (v_wallet_id, 'topup', p_amount_kobo, p_reference, 'success');

  return v_new_balance;
end;
$$;

-- initiate_withdrawal --------------------------------------------------------
-- Creates a PENDING withdrawal transaction. An external worker (Paystack webhook
-- or admin action) flips it to success/failed and adjusts the wallet on success.
create or replace function public.initiate_withdrawal(
  p_user_id uuid,
  p_amount_kobo numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance numeric;
  v_txn_id uuid;
begin
  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'p_amount_kobo must be positive';
  end if;

  select id, balance into v_wallet_id, v_balance
  from public.wallets where user_id = p_user_id for update;

  if v_wallet_id is null then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;
  if v_balance < p_amount_kobo then
    raise exception 'Insufficient balance: have %, need %', v_balance, p_amount_kobo;
  end if;

  -- Deduct immediately so balance reflects the hold. A 'failed' status later
  -- should trigger a compensating refund transaction (handled in app layer).
  update public.wallets
     set balance = balance - p_amount_kobo, updated_at = now()
   where id = v_wallet_id;

  insert into public.transactions (wallet_id, type, amount, status)
  values (v_wallet_id, 'withdrawal', -p_amount_kobo, 'pending')
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

-- connect_neighbor -----------------------------------------------------------
-- Creates a connection between a host and an already-registered neighbor (matched
-- by phone). Does NOT auto-create auth users — returns an error so admin can
-- invite the neighbor first. Returns the new connection_id.
create or replace function public.connect_neighbor(
  p_host_id uuid,
  p_neighbor_phone text,
  p_meter_id uuid,
  p_price_per_kwh numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_neighbor_id uuid;
  v_connection_id uuid;
begin
  select id into v_neighbor_id from public.profiles where phone = p_neighbor_phone;
  if v_neighbor_id is null then
    raise exception 'No registered profile with phone %. Invite the neighbor first.', p_neighbor_phone;
  end if;
  if v_neighbor_id = p_host_id then
    raise exception 'Host and neighbor cannot be the same user';
  end if;

  insert into public.connections (host_id, neighbor_id, meter_id, current_price_per_kwh, status)
  values (p_host_id, v_neighbor_id, p_meter_id, p_price_per_kwh, 'active')
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;
