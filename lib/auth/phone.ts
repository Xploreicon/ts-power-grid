/**
 * Normalize a Nigerian phone number to E.164 format (+234XXXXXXXXXX).
 *
 * Accepts:
 *   +2348100000001, 2348100000001, 08100000001, 8100000001
 *
 * Returns null for anything that doesn't fit a Nigerian MSISDN
 * (country code 234, then 10 digits starting with 7/8/9).
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  let normalized: string;

  if (digits.startsWith("234") && digits.length === 13) {
    normalized = `+${digits}`;
  } else if (digits.startsWith("0") && digits.length === 11) {
    normalized = `+234${digits.slice(1)}`;
  } else if (digits.length === 10 && /^[789]/.test(digits)) {
    normalized = `+234${digits}`;
  } else {
    return null;
  }

  return /^\+234[789]\d{9}$/.test(normalized) ? normalized : null;
}

/** Synthetic email for phone-based auth users. Keeps phones out of the email column. */
export function phoneToSyntheticEmail(phoneE164: string): string {
  const suffix = process.env.PHONE_AUTH_EMAIL_SUFFIX ?? "phone.tspowergrid.local";
  // "+2348100000001" -> "2348100000001@phone.tspowergrid.local"
  return `${phoneE164.replace(/^\+/, "")}@${suffix}`;
}
