"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-sm mx-auto bg-navy-950 text-white rounded-[16px] p-4 shadow-xl z-50 flex items-start gap-3">
      <div className="flex-1">
        <p className="font-bold text-sm">Add T&amp;S to Home Screen</p>
        <p className="text-navy-400 text-xs mt-0.5">
          Faster access and offline support
        </p>
        <Button
          size="sm"
          className="mt-3 bg-yellow-500 text-navy-950 hover:bg-yellow-400 border-0 h-8"
          onClick={handleInstall}
        >
          Install App
        </Button>
      </div>
      <button
        onClick={() => setShow(false)}
        className="text-navy-400 hover:text-white p-1 -mt-1 -mr-1 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
