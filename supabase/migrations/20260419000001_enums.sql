-- ============================================================================
-- 0001_enums.sql
-- All ENUM types used across the T&S Power Grid schema.
--
-- ROLLBACK:
--   drop type if exists public.user_role, public.kyc_status, public.path_interest,
--     public.lead_status, public.installation_type, public.site_status,
--     public.gateway_status, public.meter_type, public.meter_status,
--     public.connection_status, public.transaction_type, public.transaction_status,
--     public.installment_status, public.dispute_category, public.dispute_status;
-- ============================================================================

create type public.user_role as enum ('host', 'neighbor', 'admin', 'super_admin');
create type public.kyc_status as enum ('pending', 'verified', 'rejected');

create type public.path_interest as enum ('full_stack', 'upgrade', 'either');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'rejected');

create type public.installation_type as enum ('full_stack', 'upgrade');
create type public.site_status as enum ('pending', 'installing', 'active', 'paused', 'decommissioned');

create type public.gateway_status as enum ('provisioned', 'online', 'offline', 'faulty');

create type public.meter_type as enum ('host', 'neighbor');
create type public.meter_status as enum ('active', 'disconnected', 'faulty', 'removed');

create type public.connection_status as enum ('active', 'suspended', 'ended');

create type public.transaction_type as enum (
  'topup', 'consumption', 'withdrawal', 'platform_fee', 'installment', 'refund'
);
create type public.transaction_status as enum ('pending', 'success', 'failed');

create type public.installment_status as enum ('pending', 'paid', 'overdue', 'defaulted');

create type public.dispute_category as enum ('billing', 'disconnect', 'meter_fault', 'pricing', 'other');
create type public.dispute_status as enum ('open', 'investigating', 'resolved', 'rejected');
