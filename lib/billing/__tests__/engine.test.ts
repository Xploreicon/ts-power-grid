import { describe, it, expect } from "vitest";
import { processReading, ReadingValidationError } from "../engine";
import { makeFakeSupabase } from "./fake-supabase";

const MID = "6b1f2c0e-8a6e-4a97-b7a3-1e3b5c5f9c12";
const CID = "7a2e3d1f-9b7c-4f8a-a1d2-2c4e6a8f0b11";
const NID = "8c3f4e20-ac8d-4a99-b2e3-3d5f7b9c1d22";
const NOW = "2026-04-20T10:00:00.000Z";

function validInput(overrides: Record<string, unknown> = {}) {
  return { meterId: MID, cumulativeKwh: 10, timestamp: NOW, ...overrides };
}

describe("processReading", () => {
  it("rejects malformed input via Zod", async () => {
    const db = makeFakeSupabase();
    await expect(
      processReading(db.client, { meterId: "not-a-uuid", cumulativeKwh: 10, timestamp: NOW }),
    ).rejects.toBeInstanceOf(ReadingValidationError);
  });

  it("forwards config-driven params to the RPC", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "first_reading", action: "none" },
      error: null,
    });

    await processReading(db.client, validInput());

    const call = db.rpcCalls.find((c) => c.fn === "process_meter_reading");
    expect(call).toBeTruthy();
    expect(call!.args.p_meter_id).toBe(MID);
    expect(call!.args.p_cumulative_kwh).toBe(10);
    expect(call!.args.p_fee_rate).toBe(0.05);
    expect(call!.args.p_max_delta_kwh).toBe(100);
    expect(call!.args.p_low_balance_threshold_kobo).toBe(20000);
  });

  it("returns first_reading unchanged (no side-effects)", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "first_reading", action: "none" },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.status).toBe("first_reading");
    expect(res.action).toBe("none");
    // No disconnect/low-balance calls.
    expect(db.updates.filter((u) => u.table === "meters")).toHaveLength(0);
    expect(db.inserts.filter((i) => i.table === "notifications")).toHaveLength(0);
  });

  it("returns processed with correct billing math from RPC payload", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: {
        status: "processed",
        action: "none",
        delta_kwh: 0.5,
        amount_kobo: 14000, // 0.5 * 280 * 100
        charged_kobo: 14000,
        fee_kobo: 700,       // 5%
        host_earn_kobo: 13300,
        new_balance_kobo: 80000,
        connection_id: CID,
        transaction_id: "tx-1",
      },
      error: null,
    });

    const res = await processReading(db.client, validInput({ cumulativeKwh: 10.5 }));

    expect(res.status).toBe("processed");
    expect(res.deltaKwh).toBe(0.5);
    expect(res.amountKobo).toBe(14000);
    expect(res.feeKobo).toBe(700);
    expect(res.hostEarnKobo).toBe(13300);
    expect(res.newBalanceKobo).toBe(80000);
  });

  it("is idempotent on duplicate RPC status", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "duplicate", action: "none" },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.status).toBe("duplicate");
    expect(db.inserts.filter((i) => i.table === "notifications")).toHaveLength(0);
    expect(db.updates.filter((u) => u.table === "meters")).toHaveLength(0);
  });

  it("flags negative delta as anomaly (no billing, no disconnect)", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "anomaly_negative", action: "none", delta_kwh: -3 },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.status).toBe("anomaly_negative");
    expect(db.updates.filter((u) => u.table === "meters")).toHaveLength(0);
  });

  it("flags excessive delta as anomaly", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "anomaly_excessive", action: "none", delta_kwh: 250 },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.status).toBe("anomaly_excessive");
  });

  it("returns no_active_connection when meter is unbound", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "no_active_connection", action: "none", delta_kwh: 0.3 },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.status).toBe("no_active_connection");
  });

  it("sends low-balance notification when action=low_balance", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: {
        status: "processed",
        action: "low_balance",
        delta_kwh: 0.5,
        amount_kobo: 14000,
        charged_kobo: 14000,
        fee_kobo: 700,
        host_earn_kobo: 13300,
        new_balance_kobo: 15000, // below 20_000 threshold
        connection_id: CID,
        transaction_id: "tx-1",
      },
      error: null,
    });
    db.setSingleResponse("connections", { neighbor_id: NID });

    const res = await processReading(db.client, validInput());

    expect(res.action).toBe("low_balance");
    const notification = db.inserts.find((i) => i.table === "notifications");
    expect(notification).toBeTruthy();
    expect((notification!.row as Record<string, unknown>).user_id).toBe(NID);
    expect((notification!.row as Record<string, unknown>).type).toBe("low_balance");
  });

  it("issues disconnect when action=disconnect (drained wallet)", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: {
        status: "insufficient_funds",
        action: "disconnect",
        delta_kwh: 1,
        amount_kobo: 28000,
        charged_kobo: 5000,
        fee_kobo: 250,
        host_earn_kobo: 4750,
        new_balance_kobo: 0,
        connection_id: CID,
        transaction_id: "tx-1",
      },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.action).toBe("disconnect");
    expect(res.status).toBe("insufficient_funds");
    const meterUpdate = db.updates.find(
      (u) =>
        u.table === "meters" &&
        (u.patch as Record<string, unknown>).status === "disconnected",
    );
    expect(meterUpdate).toBeTruthy();
    expect(meterUpdate!.filter).toEqual({ id: MID });
    const disconnectAudit = db.inserts.find(
      (i) =>
        i.table === "billing_audit" &&
        (i.row as Record<string, unknown>).event_type === "disconnect_issued",
    );
    expect(disconnectAudit).toBeTruthy();
  });

  it("host-meter readings skip billing entirely", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("process_meter_reading", {
      data: { status: "host_meter", action: "none" },
      error: null,
    });

    const res = await processReading(db.client, validInput());

    expect(res.status).toBe("host_meter");
    expect(db.inserts.filter((i) => i.table === "notifications")).toHaveLength(0);
  });
});
