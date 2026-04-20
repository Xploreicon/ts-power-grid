import { NextResponse, type NextRequest } from "next/server";
import { sendPhoneOtp, OtpError } from "@/lib/auth/otp";

// Naive in-memory IP rate limit: 5 sends / minute / IP. Replace with
// @upstash/ratelimit before shipping multi-region.
const ipHits = new Map<string, { count: number; resetAt: number }>();

function rateLimitIp(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 5;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimitIp(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  try {
    const { otpToken } = await sendPhoneOtp(body.phone);
    return NextResponse.json({ otpToken });
  } catch (err) {
    if (err instanceof OtpError) {
      const status = err.code === "rate_limited" ? 429 : err.code === "invalid_phone" ? 400 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("send-otp error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
