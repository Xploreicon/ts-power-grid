import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Magic-link landing page for email sign-in.
 *
 * Flow:
 *   1. Email contains link: /auth/callback?code=<supabase pkce code>
 *   2. We exchange the code for a session (sets cookies).
 *   3. Ensure a profiles row exists (trigger creates wallet).
 *   4. Redirect to /onboarding if new / incomplete, else /host/home.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");

  const siteOrigin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (errorDescription) {
    return NextResponse.redirect(
      `${siteOrigin}/sign-in?error=${encodeURIComponent(errorDescription)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(`${siteOrigin}/sign-in`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      `${siteOrigin}/sign-in?error=${encodeURIComponent("Auth not configured")}`,
    );
  }

  const cookieStore = cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: sessionData, error: exchangeErr } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr || !sessionData?.user) {
    return NextResponse.redirect(
      `${siteOrigin}/sign-in?error=${encodeURIComponent(exchangeErr?.message ?? "Sign-in failed")}`,
    );
  }

  const user = sessionData.user;

  // Ensure profile exists so the wallet trigger fires.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      role: "neighbor",
    });
    return NextResponse.redirect(`${siteOrigin}/onboarding`);
  }

  if (!profile.full_name) {
    return NextResponse.redirect(`${siteOrigin}/onboarding`);
  }
  if (profile.role === "admin" || profile.role === "super_admin") {
    return NextResponse.redirect(`${siteOrigin}/admin`);
  }
  return NextResponse.redirect(`${siteOrigin}/host/home`);
}
