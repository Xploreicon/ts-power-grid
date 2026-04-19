import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-navy-900 text-white hover:bg-navy-800",
        success: "bg-green-100 text-green-800 border border-green-200",
        warning: "bg-amber-100 text-amber-800 border border-amber-200",
        danger: "bg-red-100 text-red-800 border border-red-200",
        yellow: "bg-yellow-500 text-navy-950",
        navy: "bg-navy-950 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

function Badge({ className, variant, dot, pulse, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "mr-1.5 h-1.5 w-1.5 rounded-full",
            variant === "success" ? "bg-green-600" : 
            variant === "danger" ? "bg-red-600" :
            variant === "yellow" ? "bg-navy-950" : "bg-current",
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
