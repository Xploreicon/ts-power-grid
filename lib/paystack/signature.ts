import "server-only";
import crypto from "crypto";

/**
 * Verify a Paystack webhook signature.
 *
 * Paystack signs the raw request body with HMAC-SHA512 using the merchant's
 * secret key. The header to compare is `x-paystack-signature`.
 *
 * We MUST use the raw body (not a re-serialised JSON) — Paystack computes
 * over the exact bytes they sent. Callers should pass request.text() result.
 */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
): boolean {
  if (!signature) return false;
  const hmac = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  // Timing-safe compare.
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
