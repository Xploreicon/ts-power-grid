import { cn } from "@/lib/utils/cn";

export interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  delta,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-navy-100 bg-white p-3 lg:p-5 shadow-sm",
        className,
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-navy-700/60 lg:text-xs">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-navy-950 lg:mt-2 lg:text-3xl">
        {value}
      </div>
      {(hint || delta) && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-navy-700/70 lg:mt-2 lg:text-xs">
          {delta ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono font-bold",
                delta.direction === "up" && "bg-green/10 text-green",
                delta.direction === "down" && "bg-red/10 text-red",
                delta.direction === "flat" && "bg-navy-100 text-navy-700",
              )}
            >
              {delta.direction === "up"
                ? "▲"
                : delta.direction === "down"
                  ? "▼"
                  : "→"}{" "}
              {delta.value}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      )}
    </div>
  );
}
