import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  prefix?: string;
  variant?: "default" | "currency" | "phone";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, hint, error, leftIcon, rightIcon, prefix, variant = "default", ...props }, ref) => {
    const resolvedPrefix =
      prefix ?? (variant === "currency" ? "₦" : variant === "phone" ? "+234" : undefined);
    const resolvedType = type ?? (variant === "phone" ? "tel" : variant === "currency" ? "text" : undefined);
    const resolvedInputMode = props.inputMode ?? (variant === "phone" ? "tel" : variant === "currency" ? "numeric" : undefined);
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-semibold text-navy-900 font-sans">
            {label}
          </label>
        )}
        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 group-focus-within:text-navy-900 transition-colors">
              {leftIcon}
            </div>
          )}
          {resolvedPrefix && !leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-mono">
              {resolvedPrefix}
            </div>
          )}
          <input
            type={resolvedType}
            inputMode={resolvedInputMode}
            className={cn(
              "flex h-11 w-full rounded-[12px] border border-navy-100 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-sans",
              leftIcon || resolvedPrefix ? "pl-12" : "pl-4",
              rightIcon ? "pr-10" : "pr-4",
              error ? "border-red-500 focus-visible:ring-red-500" : "border-navy-100",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs font-medium text-red-500">{error}</p>
        ) : hint ? (
          <p className="text-xs text-navy-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
