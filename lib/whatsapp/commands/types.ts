import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NeighborContext } from "../context";

export interface CommandInput {
  raw: string; // full message text as received
  args: string; // trimmed text after the command keyword
}

export interface CommandResult {
  /** Text to send back to the user. */
  reply: string;
  /** Optional command name to persist on the inbound log. */
  commandName?: string;
}

export type CommandHandler = (
  supabase: SupabaseClient,
  ctx: NeighborContext,
  input: CommandInput,
) => Promise<CommandResult>;
