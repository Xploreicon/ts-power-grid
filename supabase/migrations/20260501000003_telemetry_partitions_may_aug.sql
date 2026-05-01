-- ============================================================================
-- 0003_telemetry_partitions_may_aug.sql
-- Seed daily telemetry partitions for May through August 2026.
-- ============================================================================

do $$
declare
  d date;
begin
  for d in (select generate_series('2026-05-01'::date, '2026-08-31'::date, '1 day'::interval)::date) loop
    perform public.create_telemetry_partition(d);
  end loop;
end;
$$;
