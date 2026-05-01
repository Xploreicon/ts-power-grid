-- Pending connections — step 1 of 2.
--
-- Postgres won't let us reference a freshly-added enum value in the
-- same transaction that adds it (SQLSTATE 55P04: "unsafe use of new
-- value of enum type"). So this migration ONLY extends the enum.
-- The dependent column changes + CHECK constraint live in
-- 20260501000003b_pending_connections_columns.sql, which runs in
-- the next transaction once 'pending' is committed and visible.

alter type public.connection_status add value if not exists 'pending';
