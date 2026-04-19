import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300",
        className
      )}
      {...props}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-50 mb-4">
        <Icon className="h-10 w-10 text-navy-400" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-xl font-semibold text-navy-900 mb-2">
        {title}
      </h3>
      <p className="font-sans text-sm text-navy-600 max-w-[280px] mb-6">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
