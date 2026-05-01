-- Pi-config-specific fields on the meters table.
--
-- The Pi firmware's `config.yaml` declares each meter with
-- `modbus_address`, `driver` (e.g. pzem004t / hexing_hxe110 / simulator),
-- and `role`. `meter_type` already encodes role (the enum is
-- 'host' | 'neighbor'), so we only add the two missing fields.
--
-- Both nullable: existing meter rows from before this migration
-- are pre-firmware-deployment and don't have a value to fill in.
-- Validation that they're set happens at admin "add meter" time, not
-- at the schema level.

alter table public.meters
    add column if not exists modbus_address smallint
        check (modbus_address is null or modbus_address between 1 and 247);

alter table public.meters
    add column if not exists driver text
        check (driver is null or driver in ('pzem004t', 'hexing_hxe110', 'simulator'));

comment on column public.meters.modbus_address is
    'Modbus RTU slave address on the gateway''s RS-485 bus. 1-247.';
comment on column public.meters.driver is
    'Firmware driver class — pzem004t (default 2026 hardware), hexing_hxe110 (legacy retrofits), simulator (dev).';

-- Per-gateway uniqueness on modbus_address — two meters can't share an
-- address on the same RS-485 bus. Skipped when address is null so older
-- rows don't conflict.
create unique index if not exists meters_gateway_modbus_unique
    on public.meters (gateway_id, modbus_address)
    where modbus_address is not null;
