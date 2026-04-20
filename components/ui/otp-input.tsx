"use client";

import React, { useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * 6-digit OTP input with:
 * - Auto-advance on digit entry
 * - Backspace to previous
 * - Paste-to-fill (strips non-digits)
 */
export function OTPInput({
  value,
  onChange,
  disabled = false,
  error = false,
  autoFocus = true,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));
  const chars = value.padEnd(6, " ").split("").slice(0, 6);

  useEffect(() => {
    if (autoFocus) inputRefs.current[0]?.focus();
  }, [autoFocus]);

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = chars.map((c, idx) => (idx === i ? digit : c)).join("").trimEnd();
    onChange(next);
    if (digit && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (chars[i].trim()) {
        // clear current
        const next = chars.map((c, idx) => (idx === i ? " " : c)).join("").trimEnd();
        onChange(next);
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputRefs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {chars.map((char, i) => {
        const filled = char.trim() !== "";
        return (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={filled ? char : ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            className={cn(
              "h-14 w-full max-w-[52px] text-center text-2xl font-mono font-bold",
              "rounded-[12px] border bg-white outline-none transition-all",
              "focus:ring-2 focus:ring-navy-900 focus:border-navy-900",
              error
                ? "border-red-500 bg-red-50"
                : filled
                  ? "border-navy-900"
                  : "border-navy-100",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          />
        );
      })}
    </div>
  );
}
