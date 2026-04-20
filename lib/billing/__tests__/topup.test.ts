import { describe, it, expect } from "vitest";
import { processTopup, TopupValidationError } from "../topup";
import { makeFakeSupabase } from "./fake-supabase";

const UID = "6b1f2c0e-8a6e-4a97-b7a3-1e3b5c5f9c12";
const MID = "7a2e3d1f-9b7c-4f8a-a1d2-2c4e6a8f0b11";
const REF = "ps_ref_abc123";

describe("processTopup", () => {
  it("rejects invalid input", async () => {
    const db = makeFakeSupabase();
    await expect(
      processTopup(db.client, { userId: "x", amountKobo: 0, paystackReference: "" }),
    ).rejects.toBeInstanceOf(TopupValidationError);
  });

  it("credits wallet on success", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_topup", {
      data: {
        status: "success",
        transaction_id: "tx-1",
        new_balance_kobo: 500_000,
        was_zero: false,
      },
      error: null,
    });

    const res = await processTopup(db.client, {
      userId: UID,
      amountKobo: 500_000,
      paystackReference: REF,
    });

    expect(res.status).toBe("success");
    expect(res.newBalanceKobo).toBe(500_000);
    expect(res.reconnected).toBe(false);
    const rpc = db.rpcCalls.find((c) => c.fn === "process_topup");
    expect(rpc!.args.p_reference).toBe(REF);
  });

  it("is idempotent on duplicate reference", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_topup", {
      data: {
        status: "duplicate",
        transaction_id: "tx-1",
        new_balance_kobo: 500_000,
      },
      error: null,
    });

    const res = await processTopup(db.client, {
      userId: UID,
      amountKobo: 500_000,
      paystackReference: REF,
    });

    expect(res.status).toBe("duplicate");
    expect(res.reconnected).toBe(false);
  });

  it("reconnects all neighbor meters when lifting a zero balance", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_topup", {
      data: {
        status: "success",
        transaction_id: "tx-1",
        new_balance_kobo: 100_000, // above threshold
        was_zero: true,
      },
      error: null,
    });
    db.setListResponse("connections", [{ id: "c-1", meter_id: MID }]);

    const res = await processTopup(db.client, {
      userId: UID,
      amountKobo: 100_000,
      paystackReference: REF,
    });

    expect(res.reconnected).toBe(true);
    const reconnectUpdate = db.updates.find(
      (u) =>
        u.table === "meters" &&
        (u.patch as Record<string, unknown>).status === "active",
    );
    expect(reconnectUpdate).toBeTruthy();
    const reconnectAudit = db.inserts.find(
      (i) =>
        i.table === "billing_audit" &&
        (i.row as Record<string, unknown>).event_type === "reconnect_issued",
    );
    expect(reconnectAudit).toBeTruthy();
  });

  it("does NOT reconnect if topup still leaves balance below threshold", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_topup", {
      data: {
        status: "success",
        transaction_id: "tx-1",
        new_balance_kobo: 10_000, // still under 20_000
        was_zero: true,
      },
      error: null,
    });

    const res = await processTopup(db.client, {
      userId: UID,
      amountKobo: 10_000,
      paystackReference: REF,
    });

    expect(res.reconnected).toBe(false);
  });
});
