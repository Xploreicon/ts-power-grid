import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToSyntheticEmail } from "./phone";
import { sendOtpSms, TermiiError } from "@/lib/termii/client";

export class OtpError extends Error {
  constructor(message: string, readonly code: OtpErrorCode) {
    super(message);
    this.name = "OtpError";
  }
}

export type OtpErrorCode =
  | "invalid_phone"
  | "invalid_code"
  | "invalid_token"
  | "rate_limited"
  | "sms_failed"
  | "db_error"
  | "user_lookup"
  | "profile_create"
  | "link_failed";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Issue a new OTP challenge for a phone number. Rate-limited to 3 per 15 min.
 * Delivery: Termii primary. On failure in dev, logs the code to the server console.
 * In production the error surfaces so the UI can retry.
 */
export async function sendPhoneOtp(rawPhone: string): Promise<{ otpToken: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new OtpError("Invalid Nigerian phone number", "invalid_phone");

  const admin = createAdminClient();

  const { data: count, error: countErr } = await admin.rpc("otp_challenge_count_recent", {
    p_phone: phone,
    p_minutes: 15,
  });
  if (countErr) throw new OtpError(countErr.message, "db_error");
  if (typeof count === "number" && count >= 3) {
    throw new OtpError("Too many requests — try again in 15 minutes.", "rate_limited");
  }

  const code = generateCode();

  const { data: id, error: insertErr } = await admin.rpc("create_otp_challenge", {
    p_phone: phone,
    p_code: code,
    p_ttl_minutes: 5,
  });
  if (insertErr || !id) {
    throw new OtpError(insertErr?.message ?? "challenge insert failed", "db_error");
  }

  try {
    await sendOtpSms(phone, code);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[dev-otp] ${phone} -> ${code}\n`);
    } else {
      console.error("Termii send failed:", err);
      if (err instanceof TermiiError) {
        throw new OtpError("SMS provider failed", "sms_failed");
      }
    }
  }

  return { otpToken: id as string };
}

export interface VerifyPhoneOtpResult {
  tokenHash: string;
  email: string;
  phone: string;
  isNewUser: boolean;
}

/**
 * Verify a code against a challenge; on success, ensure an auth user + profile
 * exists for the phone (synthetic email under the hood) and mint a magic-link
 * token the client exchanges for a session via `verifyOtp({ type: 'magiclink' })`.
 */
export async function verifyPhoneOtp(
  otpToken: string,
  code: string,
): Promise<VerifyPhoneOtpResult> {
  const admin = createAdminClient();

  // Fetch phone early so we have it for user provisioning on success.
  const { data: challenge, error: fetchErr } = await admin
    .from("otp_challenges")
    .select("phone")
    .eq("id", otpToken)
    .maybeSingle();
  if (fetchErr) throw new OtpError(fetchErr.message, "db_error");
  if (!challenge) throw new OtpError("Invalid or expired code", "invalid_token");

  const { data: ok, error: verifyErr } = await admin.rpc("verify_otp_challenge", {
    p_id: otpToken,
    p_code: code,
  });
  if (verifyErr) throw new OtpError(verifyErr.message, "db_error");
  if (!ok) throw new OtpError("Invalid code — request a new one.", "invalid_code");

  const phone = challenge.phone as string;
  const email = phoneToSyntheticEmail(phone);

  // Find or create the auth user.
  const { data: existingId } = await admin.rpc("get_auth_user_id_by_email", {
    p_email: email,
  });

  let userId: string | null = (existingId as string | null) ?? null;
  let isNewUser = false;

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      phone,
      user_metadata: { phone_verified: true, synthetic: true },
    });
    if (createErr || !created?.user) {
      throw new OtpError(createErr?.message ?? "user creation failed", "user_lookup");
    }
    userId = created.user.id;
    isNewUser = true;

    // Minimal profile — onboarding fills in name/email/bank/KYC.
    // Trigger handle_new_profile auto-creates the wallet.
    const { error: profileErr } = await admin.from("profiles").insert({
      id: userId,
      phone,
      role: "neighbor",
    });
    if (profileErr && !/duplicate/i.test(profileErr.message)) {
      throw new OtpError(profileErr.message, "profile_create");
    }
  }

  // Mint a single-use magic-link token for the client to exchange into a session.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    throw new OtpError(linkErr?.message ?? "link generation failed", "link_failed");
  }

  return {
    tokenHash: link.properties.hashed_token,
    email,
    phone,
    isNewUser,
  };
}
