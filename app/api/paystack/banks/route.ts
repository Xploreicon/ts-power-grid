import { NextResponse } from "next/server";
import { listBanks } from "@/lib/paystack/client";

// Cache banks at the edge for 24h — list is stable.
export const revalidate = 86400;

export async function GET() {
  try {
    const banks = await listBanks();
    return NextResponse.json({
      banks: banks
        .filter((b) => b.active && b.currency === "NGN")
        .map((b) => ({
          name: b.name,
          code: b.code,
          slug: b.slug,
        })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Paystack error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
