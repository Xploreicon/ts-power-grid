-- Optional human label for a site. Admins set this when creating a
-- site from the dashboard; hosts coming through the onboarding flow
-- never set it (their site is identified by their own profile).
--
-- Nullable: existing rows pre-date the column, and the host-onboarding
-- path still doesn't ask for a name.

alter table public.sites
    add column if not exists name text;

comment on column public.sites.name is
    'Optional admin-supplied label for the site. UI falls back to host name + address when null.';
