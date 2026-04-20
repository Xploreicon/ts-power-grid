-- ============================================================================
-- 0005_telemetry.sql
-- Telemetry time-series, partitioned by day.
--
-- Followups:
--   - Schedule daily partition creation via pg_cron or an external job.
--   - Consider TimescaleDB or pg_partman for production-scale retention.
--
-- ROLLBACK:
--   drop function if exists public.create_telemetry_partition(date);
--   drop table if exists public.telemetry cascade;
-- ============================================================================

create table public.telemetry (
  id bigserial,
  meter_id uuid not null references public.meters(id) on delete cascade,
  kwh_cumulative numeric(14, 4) not null,
  voltage numeric(8, 2),
  current numeric(8, 2),
  power_factor numeric(4, 3),
  "timestamp" timestamptz not null,
  primary key (id, "timestamp")
) partition by range ("timestamp");

create index telemetry_meter_timestamp_idx on public.telemetry (meter_id, "timestamp" desc);

comment on table public.telemetry is
  'Partitioned by day on timestamp. PK includes timestamp because Postgres requires the partition key to be part of the PK.';

-- Helper: create a partition for a given day (idempotent-ish; errors if exists).
create or replace function public.create_telemetry_partition(p_day date)
returns void
language plpgsql
as $$
declare
  v_partition_name text := format('telemetry_%s', to_char(p_day, 'YYYYMMDD'));
  v_start timestamptz := p_day::timestamptz;
  v_end timestamptz := (p_day + interval '1 day')::timestamptz;
begin
  execute format(
    'create table if not exists public.%I partition of public.telemetry for values from (%L) to (%L)',
    v_partition_name, v_start, v_end
  );
end;
$$;

-- Seed partition for today so inserts work immediately after migration.
select public.create_telemetry_partition(current_date);
select public.create_telemetry_partition(current_date + 1);
