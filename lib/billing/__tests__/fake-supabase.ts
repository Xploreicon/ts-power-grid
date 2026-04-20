import { vi } from "vitest";

/**
 * Minimal Supabase test double for the billing engine. Only the call
 * shapes used by the billing modules are implemented — if a test reaches
 * for something unstubbed it throws, so gaps are loud.
 *
 * Usage:
 *   const db = makeFakeSupabase();
 *   db.setRpcResponse("process_meter_reading", { data: {...}, error: null });
 *   db.setSingleResponse("connections", { neighbor_id: "u-1" });
 *   await processReading(db.client, ...);
 *   expect(db.rpcCalls).toContainEqual({ fn: "process_meter_reading", args: {...} });
 */

type RpcResponse = { data: unknown; error: { message: string } | null };
type SingleResponse = { data: unknown; error: { message: string } | null };

export interface FakeSupabase {
  client: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  inserts: { table: string; row: unknown }[];
  updates: { table: string; patch: unknown; filter: Record<string, unknown> }[];
  setRpcResponse(fn: string, res: RpcResponse): void;
  setSingleResponse(table: string, data: unknown, error?: { message: string }): void;
  setListResponse(table: string, rows: unknown[]): void;
}

export function makeFakeSupabase(): FakeSupabase {
  const rpcResponses: Record<string, RpcResponse> = {};
  const singleResponses: Record<string, SingleResponse> = {};
  const listResponses: Record<string, { data: unknown[]; error: null }> = {};

  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const inserts: { table: string; row: unknown }[] = [];
  const updates: { table: string; patch: unknown; filter: Record<string, unknown> }[] = [];

  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcResponses[fn] ?? { data: null, error: null };
    }),
    from: (table: string) => ({
      insert: vi.fn(async (row: unknown) => {
        inserts.push({ table, row });
        return { data: null, error: null };
      }),
      update: (patch: unknown) => ({
        eq: vi.fn(async (col: string, val: unknown) => {
          updates.push({ table, patch, filter: { [col]: val } });
          return { data: null, error: null };
        }),
      }),
      select: () => {
        const filter: Record<string, unknown> = {};
        const chain = {
          eq(col: string, val: unknown) {
            filter[col] = val;
            return chain;
          },
          async maybeSingle() {
            return singleResponses[table] ?? { data: null, error: null };
          },
          then(resolve: (v: unknown) => void) {
            // Support `await supabase.from(x).select().eq(...)` as a list.
            resolve(
              listResponses[table] ?? {
                data: [],
                error: null,
              },
            );
          },
        };
        return chain;
      },
    }),
  };

  return {
    client,
    rpcCalls,
    inserts,
    updates,
    setRpcResponse(fn, res) {
      rpcResponses[fn] = res;
    },
    setSingleResponse(table, data, error = undefined) {
      singleResponses[table] = { data, error: error ?? null };
    },
    setListResponse(table, rows) {
      listResponses[table] = { data: rows, error: null };
    },
  };
}
