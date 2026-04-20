import { describe, it, expect } from "vitest";
import {
  initiateWithdrawal,
  completeWithdrawal,
  failWithdrawal,
  WithdrawValidationError,
  WithdrawProcessingError,
} from "../withdraw";
import { makeFakeSupabase } from "./fake-supabase";

const UID = "6b1f2c0e-8a6e-4a97-b7a3-1e3b5c5f9c12";
const WID = "7a2e3d1f-9b7c-4f8a-a1d2-2c4e6a8f0b11";
const REF = "ps_transfer_xyz";

describe("initiateWithdrawal", () => {
  it("rejects amounts below the minimum", async () => {
    const db = makeFakeSupabase();
    await expect(
      initiateWithdrawal(db.client, { userId: UID, amountKobo: 100 }),
    ).rejects.toBeInstanceOf(WithdrawValidationError);
  });

  it("creates a pending withdrawal and returns id", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("request_withdrawal", { data: WID, error: null });

    const res = await initiateWithdrawal(db.client, {
      userId: UID,
      amountKobo: 1_000_000,
    });

    expect(res.withdrawalId).toBe(WID);
    const call = db.rpcCalls.find((c) => c.fn === "request_withdrawal");
    expect(call!.args.p_amount_kobo).toBe(1_000_000);
  });

  it("surfaces insufficient-funds errors as processing errors", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("request_withdrawal", {
      data: null,
      error: { message: "Insufficient available balance" },
    });

    await expect(
      initiateWithdrawal(db.client, { userId: UID, amountKobo: 10_000_000 }),
    ).rejects.toBeInstanceOf(WithdrawProcessingError);
  });
});

describe("completeWithdrawal", () => {
  it("debits on success", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("complete_withdrawal", {
      data: { status: "success", new_balance_kobo: 0 },
      error: null,
    });

    const res = await completeWithdrawal(db.client, {
      withdrawalId: WID,
      paystackTransferReference: REF,
    });

    expect(res.status).toBe("success");
    expect(res.newBalanceKobo).toBe(0);
    const call = db.rpcCalls.find((c) => c.fn === "complete_withdrawal");
    expect(call!.args.p_transfer_reference).toBe(REF);
  });

  it("treats a second success call as duplicate", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("complete_withdrawal", {
      data: { status: "duplicate" },
      error: null,
    });

    const res = await completeWithdrawal(db.client, {
      withdrawalId: WID,
      paystackTransferReference: REF,
    });

    expect(res.status).toBe("duplicate");
  });
});

describe("failWithdrawal", () => {
  it("marks failed without balance change", async () => {
    const db = makeFakeSupabase();
    db.setRpcResponse("fail_withdrawal", {
      data: { status: "failed" },
      error: null,
    });

    const res = await failWithdrawal(db.client, {
      withdrawalId: WID,
      reason: "bank rejected",
    });

    expect(res.status).toBe("failed");
    // No `complete_withdrawal` call happened (no debit).
    expect(db.rpcCalls.find((c) => c.fn === "complete_withdrawal")).toBeUndefined();
    const audit = db.inserts.find(
      (i) =>
        i.table === "billing_audit" &&
        (i.row as Record<string, unknown>).event_type === "withdrawal_failed",
    );
    expect(audit).toBeTruthy();
  });
});
