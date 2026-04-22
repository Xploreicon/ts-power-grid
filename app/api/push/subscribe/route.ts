/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys?.auth || !keys?.p256dh) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Upsert the subscription
    const { error } = await adminClient.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint,
      auth: keys.auth,
      p256dh: keys.p256dh,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "endpoint"
    });

    if (error) {
      console.error("[push/subscribe] DB Error:", error);
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[push/subscribe] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
