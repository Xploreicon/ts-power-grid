// Vitest shim for the `server-only` package — the real module throws when
// imported outside a server build; tests import the billing modules
// directly so we stub it out.
export {};
