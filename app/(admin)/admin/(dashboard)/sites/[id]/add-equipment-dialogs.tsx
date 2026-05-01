"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@/components/ui";

/**
 * Two small forms — Add Gateway, Add Meter — surfaced as Radix
 * Dialogs from the equipment tab of the site detail page.
 *
 * Both POST to admin-only API routes that reject unauthenticated
 * requests via `requireAdmin`. On success we router.refresh() the
 * server component so the new row shows immediately.
 */

export function AddGatewayButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [serial, setSerial] = React.useState("");
  const [hardwareVersion, setHardwareVersion] = React.useState("");
  const [firmwareVersion, setFirmwareVersion] = React.useState("");

  const reset = React.useCallback(() => {
    setSerial("");
    setHardwareVersion("");
    setFirmwareVersion("");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) {
      toast.error("Serial number is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/gateways`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serialNumber: serial.trim(),
          hardwareVersion: hardwareVersion.trim() || undefined,
          firmwareVersion: firmwareVersion.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(
          error === "duplicate_serial"
            ? "That serial is already registered."
            : error === "site_not_found"
              ? "Site not found."
              : "Failed to add gateway.",
        );
        return;
      }
      toast.success("Gateway added");
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add gateway
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add gateway</DialogTitle>
          <DialogDescription>
            Register a Raspberry Pi. After this lands, run
            <code className="mx-1 font-mono">firmware/tools/provision.sh</code>
            to mint its certs and pairing token.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Serial number
            </label>
            <Input
              autoFocus
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="TSGW-2026-0001"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
                Hardware version
              </label>
              <Input
                value={hardwareVersion}
                onChange={(e) => setHardwareVersion(e.target.value)}
                placeholder="rev-B"
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
                Firmware version
              </label>
              <Input
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                placeholder="0.1.0"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add gateway"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface GatewayOption {
  id: string;
  serial_number: string;
}

export function AddMeterButton({
  siteId,
  gateways,
}: {
  siteId: string;
  gateways: GatewayOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [gatewayId, setGatewayId] = React.useState(gateways[0]?.id ?? "");
  const [serial, setSerial] = React.useState("");
  const [meterType, setMeterType] = React.useState<"host" | "neighbor">(
    "host",
  );
  const [modbusAddress, setModbusAddress] = React.useState("1");
  const [driver, setDriver] =
    React.useState<"pzem004t" | "hexing_hxe110" | "simulator">("pzem004t");

  // Re-sync the gateway select when the list changes (e.g. operator
  // just added one and the parent refreshed).
  React.useEffect(() => {
    if (!gatewayId && gateways[0]?.id) setGatewayId(gateways[0].id);
  }, [gateways, gatewayId]);

  const reset = React.useCallback(() => {
    setSerial("");
    setModbusAddress("1");
    setDriver("pzem004t");
    setMeterType("host");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayId) {
      toast.error("Pick a gateway first.");
      return;
    }
    if (!serial.trim()) {
      toast.error("Serial number is required.");
      return;
    }
    const addr = Number(modbusAddress);
    if (!Number.isInteger(addr) || addr < 1 || addr > 247) {
      toast.error("Modbus address must be 1–247.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/meters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gatewayId,
          serialNumber: serial.trim(),
          meterType,
          modbusAddress: addr,
          driver,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg =
          error === "modbus_address_taken"
            ? "That modbus address is already used on this gateway."
            : error === "duplicate_serial"
              ? "That serial is already registered."
              : error === "gateway_belongs_to_other_site"
                ? "Gateway isn't on this site."
                : error === "user_id_unavailable"
                  ? "Site has no host on file — assign one first."
                  : "Failed to add meter.";
        toast.error(msg);
        return;
      }
      const { id } = (await res.json()) as { id: string };
      toast.success("Meter added — click the new row to copy its UUID.");
      void id;
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const noGateways = gateways.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={noGateways}>
          <Plus className="mr-1 h-4 w-4" />
          Add meter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add meter</DialogTitle>
          <DialogDescription>
            Provision a meter against a gateway. The new meter&apos;s
            UUID will appear in the table after you submit — copy it
            into the Pi&apos;s
            <code className="mx-1 font-mono">config.yaml</code>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Gateway
            </label>
            <select
              value={gatewayId}
              onChange={(e) => setGatewayId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-2 py-1.5 font-mono text-sm"
            >
              {gateways.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.serial_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Serial number
            </label>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="TSM-2026-0001"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
                Role
              </label>
              <select
                value={meterType}
                onChange={(e) =>
                  setMeterType(e.target.value as "host" | "neighbor")
                }
                className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm capitalize"
              >
                <option value="host">Host</option>
                <option value="neighbor">Neighbor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
                Modbus addr
              </label>
              <Input
                type="number"
                min={1}
                max={247}
                value={modbusAddress}
                onChange={(e) => setModbusAddress(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
                Driver
              </label>
              <select
                value={driver}
                onChange={(e) =>
                  setDriver(
                    e.target.value as
                      | "pzem004t"
                      | "hexing_hxe110"
                      | "simulator",
                  )
                }
                className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-2 py-1.5 font-mono text-sm"
              >
                <option value="pzem004t">pzem004t</option>
                <option value="hexing_hxe110">hexing_hxe110</option>
                <option value="simulator">simulator</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add meter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
