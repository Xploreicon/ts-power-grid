// Empty shim for the `server-only` package so that standalone Node
// processes (mqtt-ingest, simulators) can import modules originally
// written for the Next.js server runtime without tripping the
// package's unconditional throw. Safe because nothing here renders
// in a client bundle — the service has no client bundle.
export {};
