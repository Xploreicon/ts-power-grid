import React from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-offwhite flex flex-col">
      {/* Slim brand header */}
      <header className="border-b border-navy-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 h-14 flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-md bg-navy-950 flex items-center justify-center">
              <div className="h-3.5 w-3.5 rounded-sm bg-yellow-500" />
            </div>
            <span className="font-display text-lg font-bold text-navy-950">T&S Power Grid</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="text-center pb-8 text-xs text-navy-400 font-sans">
        © 2026 T&S Power Grid Limited · Made in Lagos
      </footer>
    </div>
  );
}
