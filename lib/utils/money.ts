/** All monetary values in the DB are stored in KOBO (1 NGN = 100 kobo). */

export function koboToNgn(kobo: number): number {
  return kobo / 100;
}

export function formatNgn(kobo: number, opts: { compact?: boolean } = {}): string {
  const ngn = koboToNgn(kobo);
  if (opts.compact) {
    if (Math.abs(ngn) >= 1_000_000) return `₦${(ngn / 1_000_000).toFixed(1)}M`;
    if (Math.abs(ngn) >= 1_000) return `₦${(ngn / 1_000).toFixed(0)}K`;
  }
  return `₦${ngn.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Display a kobo amount with sign for a transaction (+ credit, – debit). */
export function formatTxAmount(kobo: number): string {
  const prefix = kobo >= 0 ? "+" : "";
  return `${prefix}${formatNgn(Math.abs(kobo))}`;
}
