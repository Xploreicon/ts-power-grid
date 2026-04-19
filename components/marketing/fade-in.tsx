"use client";

import dynamic from "next/dynamic";
import React, { ReactNode } from "react";

const MotionDiv = dynamic(() => import("framer-motion").then((mod) => mod.motion.div), {
  ssr: false,
});

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}

export function FadeIn({ children, delay = 0, direction = "up", className }: FadeInProps) {
  const directions = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  };

  return (
    <MotionDiv
      initial={{ 
        opacity: 0, 
        ...directions[direction] 
      }}
      whileInView={{ 
        opacity: 1, 
        x: 0, 
        y: 0 
      }}
      viewport={{ once: true }}
      transition={{ 
        duration: 0.6, 
        delay, 
        ease: "easeOut" 
      }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}
