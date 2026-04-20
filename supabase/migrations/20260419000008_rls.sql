-- ============================================================================
-- 0008_rls.sql
-- Row Level Security. Service-role key bypasses all policies — used by
-- server-side functions, webhooks, and admin scripts.
--
-- Principle: end-users interact via anon/authenticated keys, which means only
-- explicit SELECT/INSERT/UPDATE/DELETE policies apply. Financial writes
-- (wallets, transactions, telemetry) are service-role-only.
--
-- ROLLBACK: disable RLS on each table and drop policies.
-- ============================================================================

alter table public.profiles      enable row level security;
alter table public.leads         enable row level security;
alter table public.sites         enable row level security;
alter table public.gateways      enable row level security;
alter table public.meters        enable row level security;
alter table public.connections   enable row level security;
alter table public.wallets       enable row level security;
alter table public.transactions  enable row level security;
alter table public.telemetry     enable row level security;
alter table public.installments  enable row level security;
alter table public.disputes      enable row level security;
alter table public.notifications enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: read self" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: read all (admin)" on public.profiles
  for select using (public.is_admin());

create policy "profiles: update self" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles: admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

create policy "profiles: insert self" on public.profiles
  for insert with check (auth.uid() = id);

-- leads — admin-only ---------------------------------------------------------
-- Inserts come from the public marketing form via anon key; allow unauthenticated inserts.
create policy "leads: public insert" on public.leads
  for insert with check (true);

create policy "leads: admin read" on public.leads
  for select using (public.is_admin());

create policy "leads: admin update" on public.leads
  for update using (public.is_admin()) with check (public.is_admin());

create policy "leads: admin delete" on public.leads
  for delete using (public.is_admin());

-- sites ----------------------------------------------------------------------
create policy "sites: host read own" on public.sites
  for select using (auth.uid() = host_id or public.is_admin());

create policy "sites: host update own" on public.sites
  for update using (auth.uid() = host_id or public.is_admin())
  with check (auth.uid() = host_id or public.is_admin());

create policy "sites: admin insert" on public.sites
  for insert with check (public.is_admin());

create policy "sites: admin delete" on public.sites
  for delete using (public.is_admin());

-- gateways — participant read, admin write -----------------------------------
create policy "gateways: site participant read" on public.gateways
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.sites s
      where s.id = gateways.site_id and s.host_id = auth.uid()
    )
  );

create policy "gateways: admin write" on public.gateways
  for all using (public.is_admin()) with check (public.is_admin());

-- meters ---------------------------------------------------------------------
create policy "meters: owner read" on public.meters
  for select using (auth.uid() = user_id or public.is_admin());

create policy "meters: admin write" on public.meters
  for all using (public.is_admin()) with check (public.is_admin());

-- connections ----------------------------------------------------------------
create policy "connections: host or neighbor read" on public.connections
  for select using (
    auth.uid() = host_id
    or auth.uid() = neighbor_id
    or public.is_admin()
  );

create policy "connections: admin write" on public.connections
  for all using (public.is_admin()) with check (public.is_admin());

-- wallets — read self only; writes via security-definer functions only -------
create policy "wallets: read self" on public.wallets
  for select using (auth.uid() = user_id or public.is_admin());

-- transactions — read self only; writes via functions only -------------------
create policy "transactions: read own wallet" on public.transactions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.wallets w
      where w.id = transactions.wallet_id and w.user_id = auth.uid()
    )
  );

-- telemetry — participants read-only; writes via service role only -----------
create policy "telemetry: site participant read" on public.telemetry
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.meters m where m.id = telemetry.meter_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.connections c
      where c.meter_id = telemetry.meter_id
        and (c.host_id = auth.uid() or c.neighbor_id = auth.uid())
    )
  );

-- installments ---------------------------------------------------------------
create policy "installments: site host read" on public.installments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.sites s
      where s.id = installments.site_id and s.host_id = auth.uid()
    )
  );

create policy "installments: admin write" on public.installments
  for all using (public.is_admin()) with check (public.is_admin());

-- disputes -------------------------------------------------------------------
create policy "disputes: involved read" on public.disputes
  for select using (
    public.is_admin()
    or auth.uid() = raised_by
    or exists (
      select 1 from public.connections c
      where c.id = disputes.connection_id
        and (c.host_id = auth.uid() or c.neighbor_id = auth.uid())
    )
  );

create policy "disputes: raise own" on public.disputes
  for insert with check (auth.uid() = raised_by);

create policy "disputes: admin update" on public.disputes
  for update using (public.is_admin()) with check (public.is_admin());

-- notifications --------------------------------------------------------------
create policy "notifications: read own" on public.notifications
  for select using (auth.uid() = user_id or public.is_admin());

create policy "notifications: update own (mark read)" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
