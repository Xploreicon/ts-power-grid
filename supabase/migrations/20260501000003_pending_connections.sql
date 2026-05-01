-- Pending connections — let a host invite a neighbour by phone before
-- the neighbour has signed up.
--
-- Today the connect_neighbor RPC raises when no profile matches the
-- phone — too much friction for a pilot. Now we:
--   * accept the row with neighbor_id NULL
--   * stash the phone in `pending_phone` so a later sign-up can find
--     and claim the connection
--   * use a new connection_status value 'pending'
--
-- Claiming flow (separate follow-up): on neighbour sign-up, look for
-- connections where pending_phone = the new profile's phone, set
-- neighbor_id = profiles.id, status = 'active', clear pending_phone.

-- 1. Extend the connection_status enum with 'pending'.
alter type public.connection_status add value if not exists 'pending';

-- 2. Make neighbor_id nullable. Existing rows are unaffected (they were
--    already non-null). The check constraint `host_id <> neighbor_id`
--    is fine: NULL <> uuid evaluates to NULL, and CHECK passes when
--    the predicate is NULL.
alter table public.connections
    alter column neighbor_id drop not null;

-- 3. New column for the pending invite's phone. NULL once a profile
--    claims the connection.
alter table public.connections
    add column if not exists pending_phone text;

create index if not exists connections_pending_phone_idx
    on public.connections (pending_phone)
    where pending_phone is not null;

-- 4. A pending connection MUST have a phone; an active one MUST have
--    a neighbor. Encoded as one constraint to avoid two redundant
--    triggers.
alter table public.connections
    add constraint connections_pending_or_neighbor_present check (
        (status = 'pending' and pending_phone is not null and neighbor_id is null)
        or (status <> 'pending' and neighbor_id is not null)
    );

comment on column public.connections.pending_phone is
    'E.164 phone of the neighbour the host invited. Set while neighbor_id is NULL; cleared on claim.';
