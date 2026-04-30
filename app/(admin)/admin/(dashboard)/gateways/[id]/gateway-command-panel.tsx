"use client";

import * as React from "react";
import { RotateCw, UploadCloud, Fingerprint } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";

type Action = "reboot_gateway" | "update_firmware" | "reprovision";

interface ActionConfig {
  value: Action;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
  confirm: string;
  destructive?: boolean;
}

const ACTIONS: ActionConfig[] = [
  {
    value: "reboot_gateway",
    label: "Reboot gateway",
    icon: RotateCw,
    blurb: "Soft-reboot the Pi. The gateway is offline for ~30 s.",
    confirm:
      "The gateway will lose its MQTT session briefly and miss at most one telemetry tick. Continue?",
  },
  {
    value: "update_firmware",
    label: "Update firmware",
    icon: UploadCloud,
    blurb: "Pull the latest signed firmware build and apply it.",
    confirm:
      "Gateway will download + verify the signed bundle, then restart. Rollback is automatic if the new build fails to boot.",
  },
  {
    value: "reprovision",
    label: "Reprovision",
    icon: Fingerprint,
    blurb: "Rotate the device cert and re-pair with this site.",
    confirm:
      "This revokes the current client cert and pushes a fresh one. Gateway will be offline until it re-authenticates — usually under a minute.",
    destructive: true,
  },
];

export function GatewayCommandPanel({ gatewayId }: { gatewayId: string }) {
  const [pending, setPending] = React.useState<ActionConfig | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const runCommand = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/gateways/${gatewayId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pending.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          "Command failed",
          typeof data.error === "string" ? data.error : "Broker rejected the command.",
        );
        return;
      }
      toast.success(
        "Command queued",
        `${pending.label} dispatched (id ${String(data.commandId).slice(0, 8)}).`,
      );
      setPending(null);
    } catch (err) {
      toast.error(
        "Command failed",
        err instanceof Error ? err.message : "Unexpected error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.value}
              onClick={() => setPending(a)}
              className="group flex flex-col items-start gap-2 rounded-xl border border-navy-100 bg-white p-4 text-left transition-colors hover:border-navy-300"
            >
              <Icon className="h-5 w-5 text-navy-700 group-hover:text-navy-950" />
              <div className="font-semibold text-navy-900">{a.label}</div>
              <div className="text-xs text-navy-700/70">{a.blurb}</div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !submitting) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.label}</DialogTitle>
            <DialogDescription>{pending?.confirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={runCommand}
              loading={submitting}
              variant={pending?.destructive ? "danger" : "primary"}
            >
              {pending?.destructive ? "Yes, proceed" : "Send command"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
