import { cn } from "@/lib/utils/cn";

export function HealthMeter({ label, pct }: { label: string; pct: number }) {
  const tone =
    pct >= 98 ? "good" : pct >= 90 ? "attention" : "urgent";
  const color =
    tone === "good" ? "bg-green" : tone === "attention" ? "bg-amber" : "bg-red";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-navy-950">{label}</span>
        <span className="font-mono font-semibold">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
