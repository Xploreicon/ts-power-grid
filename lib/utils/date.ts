import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
} from "date-fns";

export type Period = "week" | "month" | "year";

export function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return startOfYear(now);
}

export function getTodayStart(): string {
  return startOfDay(new Date()).toISOString();
}

export function getLast7DaysRange(): { start: string; days: string[] } {
  const end = new Date();
  const start = subDays(end, 6);
  const days = eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
  return { start: startOfDay(start).toISOString(), days };
}

/**
 * Returns the bucket list for an earnings chart over a given period.
 * - week: 7 daily buckets (yyyy-MM-dd, "EEE" label)
 * - month: 30 daily buckets (yyyy-MM-dd, "d MMM" label)
 * - year: 12 monthly buckets (yyyy-MM, "MMM" label)
 */
export function getPeriodBuckets(period: Period): {
  start: string;
  buckets: { key: string; label: string }[];
  granularity: "day" | "month";
} {
  const end = new Date();
  if (period === "week") {
    const start = subDays(end, 6);
    const buckets = eachDayOfInterval({ start, end }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE"),
    }));
    return { start: startOfDay(start).toISOString(), buckets, granularity: "day" };
  }
  if (period === "month") {
    const start = subDays(end, 29);
    const buckets = eachDayOfInterval({ start, end }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label: format(d, "d"),
    }));
    return { start: startOfDay(start).toISOString(), buckets, granularity: "day" };
  }
  const start = subMonths(startOfMonth(end), 11);
  const buckets = eachMonthOfInterval({ start, end }).map((d) => ({
    key: format(d, "yyyy-MM"),
    label: format(d, "MMM"),
  }));
  return { start: start.toISOString(), buckets, granularity: "month" };
}

export function formatTs(iso: string): string {
  return format(new Date(iso), "d MMM, h:mm a");
}

export function formatDate(iso: string): string {
  return format(new Date(iso), "d MMM yyyy");
}

export function formatDay(dateStr: string): string {
  // "2026-04-19" -> "Sat"
  return format(new Date(dateStr), "EEE");
}

export function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
