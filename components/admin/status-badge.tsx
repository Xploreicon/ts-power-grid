import { cn } from "@/lib/utils/cn";

/**
 * Consistent status colour mapping across admin tables. New statuses: add
 * to TONE_MAP here so every page picks up the same colour.
 *
 * Tones: good (green) · attention (amber/yellow) · urgent (red) · neutral (grey)
 */
const TONE_MAP: Record<string, "good" | "attention" | "urgent" | "neutral"> = {
  // generic
  active: "good",
  success: "good",
  verified: "good",
  online: "good",
  paid: "good",
  resolved: "good",
  converted: "good",

  pending: "attention",
  installing: "attention",
  pending_review: "attention",
  investigating: "attention",
  contacted: "attention",
  qualified: "attention",
  low_balance: "attention",
  overdue: "attention",
  fell_back_to_sms: "attention",

  failed: "urgent",
  offline: "urgent",
  disconnected: "urgent",
  rejected: "urgent",
  faulty: "urgent",
  defaulted: "urgent",
  open: "urgent",

  paused: "neutral",
  ended: "neutral",
  decommissioned: "neutral",
  suspended: "neutral",
  removed: "neutral",
  new: "neutral",
  unknown: "neutral",
};

const TONE_CLASS = {
  good: "bg-green/10 text-green ring-green/20",
  attention: "bg-amber/10 text-amber ring-amber/20",
  urgent: "bg-red/10 text-red ring-red/20",
  neutral: "bg-navy-100 text-navy-700 ring-navy-100",
} as const;

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const key = (status ?? "unknown").toLowerCase();
  const tone = TONE_MAP[key] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          tone === "good" && "bg-green",
          tone === "attention" && "bg-amber",
          tone === "urgent" && "bg-red",
          tone === "neutral" && "bg-navy-700/40",
        )}
      />
      {(status ?? "unknown").replace(/_/g, " ")}
    </span>
  );
}
