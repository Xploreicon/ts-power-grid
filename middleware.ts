import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (err) {
    // Never 500 the whole app from middleware. Log and fall through so the
    // page renders (auth guards will still redirect if session is missing).
    console.error("[middleware] updateSession failed:", err);
    const { NextResponse } = await import("next/server");
    return NextResponse.next({ request });
  }
}

// Match everything except Next internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
