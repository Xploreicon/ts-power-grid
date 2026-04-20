import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ProgressStepsProps {
  steps: string[];
  current: number; // 1-indexed
  className?: string;
}

export function ProgressSteps({ steps, current, className }: ProgressStepsProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((label, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isActive = step === current;

        return (
          <React.Fragment key={label}>
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-navy-900 text-white ring-4 ring-navy-900/20"
                      : "bg-navy-100 text-navy-400",
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider hidden sm:block whitespace-nowrap",
                  isActive ? "text-navy-900" : isDone ? "text-green-600" : "text-navy-400",
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mb-5 mx-1 transition-all duration-500",
                  isDone ? "bg-green-500" : "bg-navy-100",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
