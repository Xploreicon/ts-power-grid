export function formatNgnKobo(kobo: number | null | undefined): string {
  const k = Number(kobo ?? 0);
  return `₦${(k / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactNumber(n: number | null | undefined): string {
  const num = Number(n ?? 0);
  return num.toLocaleString("en-NG", {
    notation: num >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  });
}
