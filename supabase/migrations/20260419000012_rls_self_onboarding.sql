-- ============================================================================
-- 0012_rls_self_onboarding.sql
-- Allow authenticated users to insert their own pending site during onboarding.
-- Without this, only admins can create sites (migration 0008).
--
-- ROLLBACK:
--   drop policy if exists "sites: self insert pending" on public.sites;
-- ============================================================================

-- Hosts can create a site for themselves, but only with status = 'pending'.
-- Admin review is required to move to 'installing' or 'active'.
create policy "sites: self insert pending" on public.sites
  for insert
  to authenticated
  with check (
    host_id = auth.uid()
    and status = 'pending'
  );
