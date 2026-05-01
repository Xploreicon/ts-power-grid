-- Update connect_neighbor to support pending invites.
--
-- New behaviour:
--   * profile by phone exists → active connection (existing flow).
--   * profile by phone missing → pending connection with the phone
--     stashed in `pending_phone`. Returns the connection_id either
--     way so the caller can audit / fire the invite SMS regardless.
--
-- The function is idempotent on (host_id, pending_phone): if the host
-- previously invited the same phone and the connection is still
-- pending, return the existing id rather than violating the
-- meter_id UNIQUE constraint.

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
  v_existing_id uuid;
  v_connection_id uuid;
begin
  select id into v_neighbor_id from public.profiles where phone = p_neighbor_phone;

  if v_neighbor_id = p_host_id then
    raise exception 'Host and neighbour cannot be the same user';
  end if;

  -- Idempotency: if this meter already has a connection (active or
  -- pending), return its id rather than crashing on the meter_id UNIQUE
  -- constraint. Lets a host hit Add Neighbor twice without leaving a
  -- broken UI state.
  select id into v_existing_id
    from public.connections
    where meter_id = p_meter_id;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if v_neighbor_id is not null then
    insert into public.connections (
      host_id, neighbor_id, meter_id, current_price_per_kwh, status
    )
    values (
      p_host_id, v_neighbor_id, p_meter_id, p_price_per_kwh, 'active'
    )
    returning id into v_connection_id;
  else
    insert into public.connections (
      host_id, neighbor_id, meter_id, current_price_per_kwh,
      status, pending_phone
    )
    values (
      p_host_id, null, p_meter_id, p_price_per_kwh,
      'pending', p_neighbor_phone
    )
    returning id into v_connection_id;
  end if;

  return v_connection_id;
end;
$$;

-- claim_pending_connection — call from the auth flow after a neighbor
-- signs up. Atomically links them to any pending connections on their
-- phone. Returns the count of claimed connections.
create or replace function public.claim_pending_connection(
  p_user_id uuid,
  p_phone text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with claimed as (
    update public.connections
       set neighbor_id   = p_user_id,
           status        = 'active',
           pending_phone = null,
           started_at    = now()
     where pending_phone = p_phone
       and status = 'pending'
       and neighbor_id is null
       and host_id <> p_user_id
    returning 1
  )
  select count(*) into v_count from claimed;
  return v_count;
end;
$$;

revoke all on function public.claim_pending_connection(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_pending_connection(uuid, text) to service_role;
