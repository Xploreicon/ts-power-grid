import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const statCardVariants = cva(
  "rounded-[12px] p-6 border transition-all",
  {
    variants: {
      variant: {
        default: "bg-white border-navy-100",
        dark: "bg-navy-900 border-navy-800 text-white",
        highlight: "bg-yellow-500 border-yellow-400 text-navy-950",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isUp: boolean;
  };
  useMono?: boolean;
}

function StatCard({
  className,
  variant,
  label,
  value,
  trend,
  useMono = false,
  ...props
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ variant, className }))} {...props}>
      <p className={cn(
        "text-sm font-medium mb-2 opacity-80 font-sans",
        variant === "dark" ? "text-navy-100" : "text-navy-700"
      )}>
        {label}
      </p>
      <div className="flex items-baseline justify-between">
        <h4 className={cn(
          "text-3xl font-bold tracking-tight",
          useMono ? "font-mono" : "font-display",
          variant === "highlight" ? "text-navy-950" : ""
        )}>
          {value}
        </h4>
        {trend && (
          <div className={cn(
            "flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full",
            trend.isUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
            variant === "dark" && trend.isUp ? "bg-green-900/30 text-green-400" : "",
            variant === "dark" && !trend.isUp ? "bg-red-900/30 text-red-400" : ""
          )}>
            {trend.isUp ? (
              <ArrowUpRight className="mr-0.5 h-3 w-3" />
            ) : (
              <ArrowDownRight className="mr-0.5 h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
}

export { StatCard };
