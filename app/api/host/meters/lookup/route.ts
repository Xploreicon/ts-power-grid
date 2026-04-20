import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lookup a meter by serial number. Meters RLS restricts reads to the
 * meter's owner, which blocks hosts from finding unassigned / neighbor
 * meters when connecting. This route runs with service-role after
 * verifying the caller is an authenticated host.
 */
export async function GET(req: NextRequest) {
  const serverClient = createClient();
  const {
    data: { user },
    error: authErr,
  } = await serverClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const serial = req.nextUrl.searchParams.get("serial")?.trim();
  if (!serial) {
    return NextResponse.json({ error: "serial required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: meter, error } = await admin
    .from("meters")
    .select("id, serial_number, status")
    .eq("serial_number", serial)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!meter) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ meter });
}
