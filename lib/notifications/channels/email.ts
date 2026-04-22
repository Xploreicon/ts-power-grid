/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy");

export async function sendEmail(
  userId: string,
  eventType: string,
  payload: { subject: string; component: React.ReactElement }
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[sendEmail] RESEND_API_KEY not configured, skipping email.");
    return false;
  }

  try {
    const supabase = createAdminClient();

    // Need email from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.email) {
      console.warn(`[sendEmail] User ${userId} has no email address, skipping Email.`);
      return false;
    }

    const html = await render(payload.component);

    const { error } = await resend.emails.send({
      from: "T&S Power Grid <noreply@tspowergrid.com>",
      to: profile.email,
      subject: payload.subject,
      html: html,
    });

    if (error) {
      console.error("[sendEmail] Resend error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[sendEmail] Exception:", err);
    return false;
  }
}
