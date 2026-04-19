import React from "react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="space-y-6">
        <h1 className="text-5xl md:text-7xl font-display text-navy-950 font-bold tracking-tight">
          T&S Power Grid
        </h1>
        <p className="text-xl md:text-2xl text-navy-700 font-sans max-w-2xl mx-auto">
          Coming soon — Empowering Nigeria with peer-to-peer power sharing.
        </p>
        <div className="flex gap-4 justify-center pt-8">
          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse delay-75" />
          <div className="h-2 w-2 rounded-full bg-yellow-300 animate-pulse delay-150" />
        </div>
      </div>
    </main>
  );
}
