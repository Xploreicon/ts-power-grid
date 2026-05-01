import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164Nigeria } from "@/lib/whatsapp/client";

/**
 * chat_id ↔ phone resolution.
 *
 * Telegram identifies users by `chat_id` — a 64-bit integer that's
 * stable across messages but otherwise meaningless to us. The bridge
 * to our world is the user sharing their phone via Telegram's
 * "Share contact" button, after which we set `profiles.telegram_chat_id`.
 *
 * Two RPCs back this:
 *   bind_telegram_chat(phone, chat_id)  — upsert the binding
 *   resolve_telegram_chat(chat_id)      — return the bound phone
 *
 * Both run with `security definer` so the service-role client is the
 * only caller. See `supabase/migrations/20260430000001_telegram_binding.sql`.
 */

export interface BindResult {
  status: "bound" | "phone_not_found" | "error";
  profileId?: string;
  phone?: string;
  reason?: string;
}

export async function bindChatToPhone(
  supabase: SupabaseClient,
  rawPhone: string,
  chatId: number,
): Promise<BindResult> {
  const phone = toE164Nigeria(rawPhone);
  if (!phone) {
    return { status: "error", reason: "phone_not_e164" };
  }

  const { data, error } = await supabase.rpc("bind_telegram_chat", {
    p_phone: phone,
    p_chat_id: chatId,
  });

  if (error) {
    console.error("[telegram] bind_telegram_chat failed:", error.message);
    return { status: "error", reason: error.message };
  }

  // The RPC returns the profile_id, or NULL when no profile matches
  // the phone. The latter is normal: a stranger started the bot before
  // their host added them.
  if (!data) {
    return { status: "phone_not_found", phone };
  }
  return { status: "bound", profileId: data as string, phone };
}

/**
 * Look up the E.164 phone bound to a chat_id. Returns null when the
 * sender hasn't completed the contact-share flow; the bot's caller
 * should reply with the onboarding prompt instead of running a
 * command.
 */
export async function resolvePhoneForChat(
  supabase: SupabaseClient,
  chatId: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_telegram_chat", {
    p_chat_id: chatId,
  });
  if (error) {
    console.error("[telegram] resolve_telegram_chat failed:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

/**
 * Look up the chat_id bound to a userId — the inverse direction used
 * by proactive senders (welcome, low-balance, disconnect, …).
 */
export async function resolveChatForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", userId)
    .maybeSingle();
  const id = data?.telegram_chat_id;
  return typeof id === "number" ? id : null;
}
