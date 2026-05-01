-- Pending connections — step 2 of 2.
--
-- Runs in a transaction *after* 20260501000003 commits the new
-- 'pending' enum value. Now we can:
--   * make neighbor_id nullable (existing rows already have values)
--   * add `pending_phone` to stash the invite target until claimed
--   * encode the invariant via a CHECK that references 'pending'
--
-- Claiming flow (see public.claim_pending_connection in 0004):
-- on neighbor sign-up, look for connections where pending_phone
-- equals the new profile's phone, set neighbor_id and flip status.

alter table public.connections
    alter column neighbor_id drop not null;

alter table public.connections
    add column if not exists pending_phone text;

create index if not exists connections_pending_phone_idx
    on public.connections (pending_phone)
    where pending_phone is not null;

-- A pending connection MUST have a phone; an active one MUST have a
-- neighbor. One CHECK rather than two triggers — the predicate is
-- easier to audit and Postgres evaluates it on every insert/update.
alter table public.connections
    add constraint connections_pending_or_neighbor_present check (
        (status = 'pending' and pending_phone is not null and neighbor_id is null)
        or (status <> 'pending' and neighbor_id is not null)
    );

comment on column public.connections.pending_phone is
    'E.164 phone of the neighbour the host invited. Set while neighbor_id is NULL; cleared on claim.';
