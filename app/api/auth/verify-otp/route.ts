import { NextResponse, type NextRequest } from "next/server";
import { verifyPhoneOtp, OtpError } from "@/lib/auth/otp";

export async function POST(req: NextRequest) {
  let body: { otpToken?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.otpToken || !body.code) {
    return NextResponse.json({ error: "otpToken and code are required" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "code must be 6 digits" }, { status: 400 });
  }

  try {
    const result = await verifyPhoneOtp(body.otpToken, body.code);
    // The client exchanges tokenHash for a session via
    //   supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
    // which sets the auth cookies in the browser.
    return NextResponse.json({
      tokenHash: result.tokenHash,
      email: result.email,
      phone: result.phone,
      isNewUser: result.isNewUser,
    });
  } catch (err) {
    if (err instanceof OtpError) {
      const status =
        err.code === "invalid_code" || err.code === "invalid_token" ? 400 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("verify-otp error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
