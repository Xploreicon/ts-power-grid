import "server-only";
import type { CommandHandler } from "./types";

/**
 * REPORT <description> — create a dispute against the active connection.
 * Category defaults to 'other'; the dashboard triages.
 */
export const reportHandler: CommandHandler = async (supabase, ctx, input) => {
  const description = input.args.trim();
  if (description.length < 10) {
    return {
      reply:
        'Please include a short description, e.g. "REPORT meter offline since morning".',
    };
  }
  if (!ctx.profile || !ctx.connection) {
    return {
      reply:
        "You need an active connection to raise a ticket. Ask your host to set one up.",
    };
  }

  const { error } = await supabase.from("disputes").insert({
    raised_by: ctx.profile.id,
    connection_id: ctx.connection.id,
    category: "other",
    description: description.slice(0, 2000),
    metadata: { source: "whatsapp" },
  });

  if (error) {
    return {
      reply:
        "We couldn't save your ticket right now. Please try again, or call support.",
    };
  }

  return {
    reply:
      "Got it — ticket created. We'll respond within 24 hours. Thanks for letting us know.",
  };
};
