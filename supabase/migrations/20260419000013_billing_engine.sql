-- ============================================================================
-- 0013_billing_engine.sql
-- Core billing engine: atomic meter-reading processing, hold-based withdrawals,
-- audit trail, gateway API key storage.
--
-- All monetary math is in KOBO (integer). kWh can carry up to 3 decimals.
--
-- ROLLBACK:
--   drop function if exists public.process_meter_reading(uuid, numeric, timestamptz, numeric, numeric, numeric);
--   drop function if exists public.request_withdrawal(uuid, numeric);
--   drop function if exists public.complete_withdrawal(uuid, text);
--   drop function if exists public.fail_withdrawal(uuid, text);
--   drop function if exists public.process_topup(uuid, numeric, text);
--   alter table public.gateways drop column if exists api_key_hash;
--   drop table if exists public.billing_audit cascade;
-- ============================================================================

-- billing_audit --------------------------------------------------------------
create table public.billing_audit (
  id bigserial primary key,
  event_type text not null,
  meter_id uuid references public.meters(id) on delete set null,
  connection_id uuid references public.connections(id) on delete set null,
  wallet_id uuid references public.wallets(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_audit_event_type_idx on public.billing_audit (event_type);
create index billing_audit_meter_id_idx on public.billing_audit (meter_id);
create index billing_audit_connection_id_idx on public.billing_audit (connection_id);
create index billing_audit_created_at_idx on public.billing_audit (created_at desc);

comment on table public.billing_audit is
  'Append-only audit log for every billing event (readings, charges, anomalies, disconnects, topups, withdrawals). Never mutate or delete rows.';

-- RLS: admin-only reads, service role writes ---------------------------------
alter table public.billing_audit enable row level security;

create policy "billing_audit: admin read" on public.billing_audit
  for select using (public.is_admin());

-- No insert/update/delete policies → only service_role can write.

-- gateways.api_key_hash ------------------------------------------------------
alter table public.gateways
  add column if not exists api_key_hash text;

comment on column public.gateways.api_key_hash is
  'SHA-256 hex of the gateway API key. Gateway auth compares hash, never stores plaintext.';

create index if not exists gateways_api_key_hash_idx on public.gateways (api_key_hash)
  where api_key_hash is not null;

-- ---------------------------------------------------------------------------
-- process_meter_reading
-- ---------------------------------------------------------------------------
-- Single atomic entry point for consumption billing. Idempotent on
-- (meter_id, cumulative_kwh) via the unique transaction reference
-- "reading:<meter_id>:<cumulative_kwh>".
--
-- Returns a jsonb describing the outcome. The caller (TS engine) decides
-- whether to dispatch side-effects (disconnect command, low-balance push).
--
-- Status values:
--   first_reading        — meter had no prior reading; stored as baseline.
--   host_meter           — host-side meter; telemetry only, no billing.
--   flat_reading         — delta was zero (duplicate timestamp / no consumption).
--   processed            — billing succeeded. See action for follow-up.
--   duplicate            — this exact (meter, cumulative) pair already processed.
--   anomaly_negative     — cumulative went backwards (meter reset / fault).
--   anomaly_excessive    — delta exceeded the configured safety ceiling.
--   no_active_connection — meter has no active connection to bill against.
--   insufficient_funds   — wallet had some balance but less than the charge;
--                          partial debit applied and action = 'disconnect'.
--
-- Action values:
--   none | low_balance | disconnect
-- ---------------------------------------------------------------------------
create or replace function public.process_meter_reading(
  p_meter_id uuid,
  p_cumulative_kwh numeric,
  p_timestamp timestamptz,
  p_fee_rate numeric default 0.05,
  p_max_delta_kwh numeric default 100,
  p_low_balance_threshold_kobo numeric default 20000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter        record;
  v_prev         numeric;
  v_delta        numeric;
  v_reference    text;
  v_conn         record;
  v_neighbor_w   uuid;
  v_host_w       uuid;
  v_n_balance    numeric;
  v_amount       numeric;
  v_fee          numeric;
  v_host_earn    numeric;
  v_charged      numeric;
  v_new_balance  numeric;
  v_txn_id       uuid;
  v_action       text := 'none';
  v_status       text;
  v_insufficient boolean := false;
begin
  if p_cumulative_kwh is null or p_cumulative_kwh < 0 then
    raise exception 'p_cumulative_kwh must be non-negative, got %', p_cumulative_kwh;
  end if;

  -- Lock the meter row so concurrent readings serialize per-meter.
  select * into v_meter from public.meters where id = p_meter_id for update;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id;
  end if;

  v_reference := 'reading:' || p_meter_id::text || ':' || p_cumulative_kwh::text;

  -- Idempotency: short-circuit if this exact reading already produced a txn.
  if exists (select 1 from public.transactions where reference = v_reference) then
    insert into public.billing_audit (event_type, meter_id, details)
    values ('reading_duplicate', p_meter_id,
            jsonb_build_object('cumulative_kwh', p_cumulative_kwh,
                               'timestamp', p_timestamp));
    return jsonb_build_object('status', 'duplicate', 'action', 'none');
  end if;

  v_prev := v_meter.last_reading_kwh;

  -- Host meter: just record telemetry, no billing.
  if v_meter.meter_type = 'host' then
    update public.meters
       set last_reading_kwh = p_cumulative_kwh, updated_at = now()
     where id = p_meter_id;

    insert into public.telemetry (meter_id, kwh_cumulative, "timestamp")
    values (p_meter_id, p_cumulative_kwh, p_timestamp);

    insert into public.billing_audit (event_type, meter_id, details)
    values ('reading_host_meter', p_meter_id,
            jsonb_build_object('cumulative_kwh', p_cumulative_kwh));

    return jsonb_build_object('status', 'host_meter', 'action', 'none');
  end if;

  -- Neighbor meter — first-reading branch.
  if v_prev is null then
    update public.meters
       set last_reading_kwh = p_cumulative_kwh, updated_at = now()
     where id = p_meter_id;

    insert into public.telemetry (meter_id, kwh_cumulative, "timestamp")
    values (p_meter_id, p_cumulative_kwh, p_timestamp);

    insert into public.billing_audit (event_type, meter_id, details)
    values ('reading_first', p_meter_id,
            jsonb_build_object('baseline_kwh', p_cumulative_kwh));

    return jsonb_build_object('status', 'first_reading', 'action', 'none');
  end if;

  v_delta := p_cumulative_kwh - v_prev;

  -- Anomalies: do NOT update last_reading so the next valid reading still
  -- produces a usable delta (and an admin can investigate the gap).
  if v_delta < 0 then
    insert into public.billing_audit (event_type, meter_id, details)
    values ('reading_anomaly_negative', p_meter_id,
            jsonb_build_object('cumulative_kwh', p_cumulative_kwh,
                               'previous_kwh', v_prev,
                               'delta_kwh', v_delta));
    return jsonb_build_object('status', 'anomaly_negative',
                              'delta_kwh', v_delta, 'action', 'none');
  end if;

  if v_delta > p_max_delta_kwh then
    insert into public.billing_audit (event_type, meter_id, details)
    values ('reading_anomaly_excessive', p_meter_id,
            jsonb_build_object('cumulative_kwh', p_cumulative_kwh,
                               'previous_kwh', v_prev,
                               'delta_kwh', v_delta,
                               'max_allowed', p_max_delta_kwh));
    return jsonb_build_object('status', 'anomaly_excessive',
                              'delta_kwh', v_delta, 'action', 'none');
  end if;

  -- Flat reading: no energy consumed since last sample. Record telemetry.
  if v_delta = 0 then
    insert into public.telemetry (meter_id, kwh_cumulative, "timestamp")
    values (p_meter_id, p_cumulative_kwh, p_timestamp);
    return jsonb_build_object('status', 'flat_reading',
                              'delta_kwh', 0, 'action', 'none');
  end if;

  -- Find the active connection to bill.
  select * into v_conn
    from public.connections
   where meter_id = p_meter_id and status = 'active'
   limit 1;

  if v_conn.id is null then
    insert into public.billing_audit (event_type, meter_id, details)
    values ('reading_no_connection', p_meter_id,
            jsonb_build_object('cumulative_kwh', p_cumulative_kwh,
                               'delta_kwh', v_delta));
    return jsonb_build_object('status', 'no_active_connection',
                              'delta_kwh', v_delta, 'action', 'none');
  end if;

  -- Compute charge in integer kobo.
  v_amount := round(v_delta * v_conn.current_price_per_kwh * 100);
  if v_amount <= 0 then
    -- Sub-kobo consumption rounds to zero. Record telemetry and move on.
    update public.meters
       set last_reading_kwh = p_cumulative_kwh, updated_at = now()
     where id = p_meter_id;
    insert into public.telemetry (meter_id, kwh_cumulative, "timestamp")
    values (p_meter_id, p_cumulative_kwh, p_timestamp);
    return jsonb_build_object('status', 'flat_reading',
                              'delta_kwh', v_delta, 'action', 'none');
  end if;

  -- Lock both wallets in a stable order (neighbor first, then host) to avoid
  -- deadlocks when two readings for different meters interleave.
  select id, balance into v_neighbor_w, v_n_balance
    from public.wallets where user_id = v_conn.neighbor_id for update;
  if v_neighbor_w is null then
    raise exception 'Neighbor wallet missing for user %', v_conn.neighbor_id;
  end if;

  select id into v_host_w
    from public.wallets where user_id = v_conn.host_id for update;
  if v_host_w is null then
    raise exception 'Host wallet missing for user %', v_conn.host_id;
  end if;

  -- Cap the charge at the available balance. Any shortfall triggers disconnect.
  v_charged := least(v_amount, v_n_balance);
  if v_charged < v_amount then
    v_insufficient := true;
  end if;
  v_fee       := round(v_charged * p_fee_rate);
  v_host_earn := v_charged - v_fee;

  -- Debit neighbor wallet.
  update public.wallets
     set balance = balance - v_charged, updated_at = now()
   where id = v_neighbor_w
  returning balance into v_new_balance;

  -- Neighbor consumption transaction (carries the idempotency reference).
  insert into public.transactions
    (wallet_id, type, amount, reference, connection_id, kwh_consumed, status, metadata)
  values
    (v_neighbor_w, 'consumption', -v_charged, v_reference, v_conn.id, v_delta, 'success',
     jsonb_build_object(
       'price_per_kwh', v_conn.current_price_per_kwh,
       'platform_fee_kobo', v_fee,
       'gross_kobo', v_amount,
       'charged_kobo', v_charged,
       'insufficient_funds', v_insufficient,
       'cumulative_kwh', p_cumulative_kwh
     ))
  returning id into v_txn_id;

  -- Credit host wallet with net-of-fee earnings.
  if v_host_earn > 0 then
    update public.wallets
       set balance = balance + v_host_earn, updated_at = now()
     where id = v_host_w;

    insert into public.transactions
      (wallet_id, type, amount, reference, connection_id, kwh_consumed, status, metadata)
    values
      (v_host_w, 'consumption', v_host_earn,
       v_reference || ':host', v_conn.id, v_delta, 'success',
       jsonb_build_object(
         'gross_kobo', v_amount,
         'charged_kobo', v_charged,
         'platform_fee_kobo', v_fee,
         'neighbor_txn_id', v_txn_id
       ));
  end if;

  -- Record platform fee explicitly. No treasury wallet yet → metadata-only
  -- row on the host wallet, marked as `platform_fee` so aggregates stay clean.
  -- Followup: introduce a dedicated platform-treasury wallet and migrate.
  if v_fee > 0 then
    insert into public.transactions
      (wallet_id, type, amount, reference, connection_id, kwh_consumed, status, metadata)
    values
      (v_host_w, 'platform_fee', -v_fee,
       v_reference || ':fee', v_conn.id, v_delta, 'success',
       jsonb_build_object(
         'gross_kobo', v_amount,
         'charged_kobo', v_charged,
         'note', 'Accounting-only: host wallet holds the fee attribution pending treasury wallet rollout.'
       ));
  end if;

  -- Advance meter pointer + telemetry.
  update public.meters
     set last_reading_kwh = p_cumulative_kwh, updated_at = now()
   where id = p_meter_id;

  insert into public.telemetry (meter_id, kwh_cumulative, "timestamp")
  values (p_meter_id, p_cumulative_kwh, p_timestamp);

  -- Decide downstream action.
  if v_new_balance <= 0 or v_insufficient then
    v_action := 'disconnect';
  elsif v_new_balance <= p_low_balance_threshold_kobo then
    v_action := 'low_balance';
  end if;

  v_status := case when v_insufficient then 'insufficient_funds' else 'processed' end;

  insert into public.billing_audit (event_type, meter_id, connection_id, wallet_id, details)
  values ('reading_charged', p_meter_id, v_conn.id, v_neighbor_w,
          jsonb_build_object(
            'delta_kwh', v_delta,
            'amount_kobo', v_amount,
            'charged_kobo', v_charged,
            'fee_kobo', v_fee,
            'host_earn_kobo', v_host_earn,
            'new_balance_kobo', v_new_balance,
            'price_per_kwh', v_conn.current_price_per_kwh,
            'action', v_action,
            'insufficient', v_insufficient,
            'transaction_id', v_txn_id
          ));

  return jsonb_build_object(
    'status',           v_status,
    'delta_kwh',        v_delta,
    'amount_kobo',      v_amount,
    'charged_kobo',     v_charged,
    'fee_kobo',         v_fee,
    'host_earn_kobo',   v_host_earn,
    'new_balance_kobo', v_new_balance,
    'connection_id',    v_conn.id,
    'transaction_id',   v_txn_id,
    'action',           v_action
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- process_topup — idempotent on paystack reference.
-- ---------------------------------------------------------------------------
create or replace function public.process_topup(
  p_user_id uuid,
  p_amount_kobo numeric,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
  v_txn_id uuid;
  v_had_zero boolean;
begin
  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'p_amount_kobo must be positive';
  end if;
  if p_reference is null or length(p_reference) < 3 then
    raise exception 'p_reference required';
  end if;

  -- Idempotent: if reference already used, return the existing result.
  select t.id into v_txn_id from public.transactions t where t.reference = p_reference;
  if v_txn_id is not null then
    select w.balance into v_new_balance from public.wallets w
      join public.transactions t on t.wallet_id = w.id where t.id = v_txn_id;
    return jsonb_build_object(
      'status', 'duplicate',
      'transaction_id', v_txn_id,
      'new_balance_kobo', v_new_balance
    );
  end if;

  select id, balance into v_wallet_id, v_new_balance
    from public.wallets where user_id = p_user_id for update;
  if v_wallet_id is null then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;
  v_had_zero := (v_new_balance <= 0);

  update public.wallets
     set balance = balance + p_amount_kobo, updated_at = now()
   where id = v_wallet_id
  returning balance into v_new_balance;

  insert into public.transactions (wallet_id, type, amount, reference, status, metadata)
  values (v_wallet_id, 'topup', p_amount_kobo, p_reference, 'success',
          jsonb_build_object('source', 'paystack'))
  returning id into v_txn_id;

  insert into public.billing_audit (event_type, wallet_id, details)
  values ('topup_success', v_wallet_id,
          jsonb_build_object(
            'amount_kobo', p_amount_kobo,
            'reference', p_reference,
            'new_balance_kobo', v_new_balance,
            'was_zero', v_had_zero,
            'transaction_id', v_txn_id
          ));

  return jsonb_build_object(
    'status', 'success',
    'transaction_id', v_txn_id,
    'new_balance_kobo', v_new_balance,
    'was_zero', v_had_zero
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hold-based withdrawal flow (new engine).
--
-- request_withdrawal  → creates a PENDING transaction; no balance change.
--                       Available balance = wallet.balance − sum(pending withdrawals).
-- complete_withdrawal → flips to SUCCESS and debits the balance.
-- fail_withdrawal     → flips to FAILED; no balance change.
--
-- Semantics differ from the older `initiate_withdrawal` (which debited on
-- request). New code should use this flow; the older function is retained
-- for back-compat only.
-- ---------------------------------------------------------------------------
create or replace function public.request_withdrawal(
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
  v_pending numeric;
  v_available numeric;
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

  select coalesce(sum(-amount), 0) into v_pending
    from public.transactions
   where wallet_id = v_wallet_id
     and type = 'withdrawal'
     and status = 'pending';

  v_available := v_balance - v_pending;
  if v_available < p_amount_kobo then
    raise exception 'Insufficient available balance: have % kobo, need %', v_available, p_amount_kobo;
  end if;

  insert into public.transactions (wallet_id, type, amount, status, metadata)
  values (v_wallet_id, 'withdrawal', -p_amount_kobo, 'pending',
          jsonb_build_object('requested_at', now()))
  returning id into v_txn_id;

  insert into public.billing_audit (event_type, wallet_id, details)
  values ('withdrawal_requested', v_wallet_id,
          jsonb_build_object(
            'amount_kobo', p_amount_kobo,
            'available_kobo', v_available,
            'transaction_id', v_txn_id
          ));

  return v_txn_id;
end;
$$;

create or replace function public.complete_withdrawal(
  p_txn_id uuid,
  p_transfer_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn record;
  v_new_balance numeric;
begin
  select * into v_txn from public.transactions where id = p_txn_id for update;
  if v_txn.id is null then
    raise exception 'Withdrawal % not found', p_txn_id;
  end if;
  if v_txn.type <> 'withdrawal' then
    raise exception 'Transaction % is not a withdrawal', p_txn_id;
  end if;
  if v_txn.status = 'success' then
    return jsonb_build_object('status', 'duplicate', 'transaction_id', p_txn_id);
  end if;
  if v_txn.status <> 'pending' then
    raise exception 'Withdrawal % is not pending (status=%)', p_txn_id, v_txn.status;
  end if;

  update public.wallets
     set balance = balance + v_txn.amount, updated_at = now() -- amount is negative
   where id = v_txn.wallet_id
  returning balance into v_new_balance;

  update public.transactions
     set status = 'success',
         reference = p_transfer_reference,
         metadata = metadata || jsonb_build_object('completed_at', now(),
                                                   'transfer_reference', p_transfer_reference)
   where id = p_txn_id;

  insert into public.billing_audit (event_type, wallet_id, details)
  values ('withdrawal_completed', v_txn.wallet_id,
          jsonb_build_object(
            'amount_kobo', -v_txn.amount,
            'transaction_id', p_txn_id,
            'transfer_reference', p_transfer_reference,
            'new_balance_kobo', v_new_balance
          ));

  return jsonb_build_object(
    'status', 'success',
    'transaction_id', p_txn_id,
    'new_balance_kobo', v_new_balance
  );
end;
$$;

create or replace function public.fail_withdrawal(
  p_txn_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn record;
begin
  select * into v_txn from public.transactions where id = p_txn_id for update;
  if v_txn.id is null then
    raise exception 'Withdrawal % not found', p_txn_id;
  end if;
  if v_txn.type <> 'withdrawal' then
    raise exception 'Transaction % is not a withdrawal', p_txn_id;
  end if;
  if v_txn.status = 'failed' then
    return jsonb_build_object('status', 'duplicate', 'transaction_id', p_txn_id);
  end if;
  if v_txn.status <> 'pending' then
    raise exception 'Withdrawal % is not pending (status=%)', p_txn_id, v_txn.status;
  end if;

  update public.transactions
     set status = 'failed',
         metadata = metadata || jsonb_build_object('failed_at', now(),
                                                   'failure_reason', p_reason)
   where id = p_txn_id;

  insert into public.billing_audit (event_type, wallet_id, details)
  values ('withdrawal_failed', v_txn.wallet_id,
          jsonb_build_object(
            'amount_kobo', -v_txn.amount,
            'transaction_id', p_txn_id,
            'reason', p_reason
          ));

  return jsonb_build_object(
    'status', 'failed',
    'transaction_id', p_txn_id
  );
end;
$$;
