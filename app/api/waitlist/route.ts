import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// In-memory rate limiter — 3 submissions per IP per hour
// ---------------------------------------------------------------------------
const hits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// Cleanup stale entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of Array.from(hits.entries())) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, 10 * 60 * 1000).unref?.();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const nigerianPhoneRegex = /^(\+?234|0)[789]\d{9}$/;

const waitlistSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  phone: z.string().regex(nigerianPhoneRegex, "Enter a valid Nigerian phone number"),
  email: z.string().email().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  address: z.string().min(3, "Address is required"),
  lga: z.string().min(1, "LGA is required"),
  property_type: z.string().optional().or(z.literal("")),
  ownership: z.string().optional().or(z.literal("")),
  neighbor_count: z.string().optional().or(z.literal("")),
  rooftop_access: z.string().optional().or(z.literal("")),
  path: z.enum(["upgrade_kit", "full_stack"]),
  panel_capacity: z.string().optional().or(z.literal("")),
  inverter_model: z.string().optional().or(z.literal("")),
  battery_type: z.string().optional().or(z.literal("")),
  system_age: z.string().optional().or(z.literal("")),
  surplus_power: z.string().optional().or(z.literal("")),
  monthly_power_spend: z.string().min(1, "Monthly power spend is required"),
  primary_power_source: z.string().optional().or(z.literal("")),
  payment_preference: z.string().optional().or(z.literal("")),
  timeline: z.string().optional().or(z.literal("")),
  target_price_per_kwh: z.string().optional().or(z.literal("")),
  drone_assessment: z.string().optional().or(z.literal("")),
  referral_source: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Telegram notification (best-effort)
// ---------------------------------------------------------------------------
async function notifyTelegram(data: z.infer<typeof waitlistSchema>) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_TEAM_CHAT_ID;
    if (!token || !chatId) return;

    const pathLabel = data.path === "upgrade_kit" ? "Upgrade Kit" : "Full Stack";
    const text = [
      `🔔 New Waitlist Submission`,
      ``,
      `Name: ${data.full_name}`,
      `Phone: ${data.phone}`,
      `Area: ${data.lga}`,
      `Path: ${pathLabel}`,
      `Monthly spend: ${data.monthly_power_spend}`,
      `Timeline: ${data.timeline || "Not specified"}`,
      `Payment: ${data.payment_preference || "Not specified"}`,
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Non-fatal — don't fail the submission
    console.error("[waitlist] Telegram notification failed");
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Normalize empty strings to null for DB
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    row[key] = typeof value === "string" && value.trim() === "" ? null : value;
  }

  // Insert
  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("waitlist_submissions")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[waitlist] insert failed:", error.message);
    return NextResponse.json(
      { error: "Submission failed. Please try again." },
      { status: 500 },
    );
  }

  // Best-effort Telegram notification
  notifyTelegram(data);

  return NextResponse.json({ success: true, id: inserted.id }, { status: 201 });
}
