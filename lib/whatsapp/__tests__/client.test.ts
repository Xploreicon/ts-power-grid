import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { toE164Nigeria, verifyWhatsAppSignature } from "../client";

describe("toE164Nigeria", () => {
  it.each([
    ["+2348012345678", "+2348012345678"],
    ["2348012345678", "+2348012345678"],
    ["08012345678", "+2348012345678"],
    ["8012345678", "+2348012345678"],
    ["+234 801 234 5678", "+2348012345678"],
  ])("normalises %s → %s", (input, expected) => {
    expect(toE164Nigeria(input)).toBe(expected);
  });

  it("returns null for garbage", () => {
    expect(toE164Nigeria("")).toBeNull();
    expect(toE164Nigeria("hello")).toBeNull();
    expect(toE164Nigeria("123")).toBeNull();
  });
});

describe("verifyWhatsAppSignature", () => {
  const secret = "test-app-secret";
  const body = JSON.stringify({ event: "message" });
  const sig =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("accepts valid signature", () => {
    expect(verifyWhatsAppSignature(body, sig, secret)).toBe(true);
  });

  it("rejects missing header", () => {
    expect(verifyWhatsAppSignature(body, null, secret)).toBe(false);
  });

  it("rejects malformed header", () => {
    expect(verifyWhatsAppSignature(body, "sha1=abc", secret)).toBe(false);
  });

  it("rejects mismatched signature", () => {
    expect(
      verifyWhatsAppSignature(body, "sha256=" + "0".repeat(64), secret),
    ).toBe(false);
  });

  it("rejects tampered body", () => {
    expect(verifyWhatsAppSignature(body + "x", sig, secret)).toBe(false);
  });
});
