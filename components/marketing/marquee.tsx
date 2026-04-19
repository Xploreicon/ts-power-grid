"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

interface MarqueeProps {
  items: string[];
  className?: string;
  speed?: "slow" | "fast" | "normal";
}

export function Marquee({ items, className, speed = "slow" }: MarqueeProps) {
  const speedClass = 
    speed === "fast" ? "animate-marquee-fast" : 
    speed === "slow" ? "animate-marquee-slow" : "animate-marquee";

  return (
    <div className={cn("relative flex overflow-x-hidden bg-navy-950 py-4", className)}>
      <div className={cn("flex whitespace-nowrap", speedClass)}>
        {[...items, ...items].map((item, idx) => (
          <span
            key={idx}
            className="mx-4 flex items-center font-display text-xl italic text-white/90"
          >
            {item}
            <span className="ml-8 text-yellow-500">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
