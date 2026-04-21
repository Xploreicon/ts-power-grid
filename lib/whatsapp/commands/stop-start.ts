import "server-only";
import type { CommandHandler } from "./types";

/**
 * STOP — opt out of auto-reconnect on top-up after zero balance.
 * The user can still manually reconnect from the web app; we just don't
 * flip the meter on automatically when they pay again.
 */
export const stopHandler: CommandHandler = async (supabase, ctx) => {
  if (!ctx.profile) {
    return { reply: "We couldn't find your account." };
  }
  await supabase
    .from("profiles")
    .update({
      notification_prefs: {
        ...ctx.profile.notification_prefs,
        auto_reconnect: false,
      },
    })
    .eq("id", ctx.profile.id);

  return {
    reply:
      "Auto-reconnect is OFF. Your meter will not reconnect automatically after a top-up. Reply START to turn it back on.",
  };
};

/** START — re-enable auto-reconnect. */
export const startHandler: CommandHandler = async (supabase, ctx) => {
  if (!ctx.profile) {
    return { reply: "We couldn't find your account." };
  }
  await supabase
    .from("profiles")
    .update({
      notification_prefs: {
        ...ctx.profile.notification_prefs,
        auto_reconnect: true,
      },
    })
    .eq("id", ctx.profile.id);

  return {
    reply:
      "Auto-reconnect is ON. Your meter will reconnect automatically after you top up.",
  };
};
