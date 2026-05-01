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
 * Admin "Create site" modal. Used to provision sites for the prototype
 * without forcing every host through the public onboarding flow.
 *
 * On success: redirect to the new site's detail page so the operator
 * can immediately add gateways + meters.
 */

export interface HostOption {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export function CreateSiteButton({ hosts }: { hosts: HostOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [hostId, setHostId] = React.useState(hosts[0]?.id ?? "");
  const [installationType, setInstallationType] =
    React.useState<"full_stack" | "upgrade">("full_stack");

  // Re-sync the host select when the parent refreshes the list (e.g.
  // a new host signed up while the dialog was open).
  React.useEffect(() => {
    if (!hostId && hosts[0]?.id) setHostId(hosts[0].id);
  }, [hosts, hostId]);

  const reset = React.useCallback(() => {
    setName("");
    setAddress("");
    setInstallationType("full_stack");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostId) {
      toast.error("Pick a host first.");
      return;
    }
    if (address.trim().length < 5) {
      toast.error("Address looks too short.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          address: address.trim(),
          hostId,
          installationType,
        }),
      });
      if (!res.ok) {
        const { error, role } = (await res.json().catch(() => ({}))) as {
          error?: string;
          role?: string;
        };
        const msg =
          error === "host_not_found"
            ? "That host id isn't a profile."
            : error === "user_not_a_host"
              ? `That user has role "${role}", not host.`
              : "Failed to create site.";
        toast.error(msg);
        return;
      }
      const { id } = (await res.json()) as { id: string };
      reset();
      setOpen(false);
      toast.success("Site created");
      router.push(`/admin/sites/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Create site
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create site</DialogTitle>
          <DialogDescription>
            Provision a site for an existing host. Capacity / lagos_area
            are captured later during the site survey.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Site name <span className="text-navy-700/50">(optional)</span>
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Adeola residence — Lekki Phase 1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Address
            </label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 Admiralty Way, Lekki Phase 1, Lagos"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Host
            </label>
            {hosts.length === 0 ? (
              <p className="mt-1 rounded-md border border-amber/30 bg-amber/10 px-2 py-1.5 text-xs text-navy-700">
                No host-role users yet. Promote a profile via SQL or have
                someone complete host onboarding first.
              </p>
            ) : (
              <select
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm"
              >
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.full_name ?? "(unnamed)"}
                    {h.phone ? ` — ${h.phone}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700/70">
              Installation type
            </label>
            <select
              value={installationType}
              onChange={(e) =>
                setInstallationType(
                  e.target.value as "full_stack" | "upgrade",
                )
              }
              className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm capitalize"
            >
              <option value="full_stack">Full stack (₦6M)</option>
              <option value="upgrade">Upgrade kit (₦800K+)</option>
            </select>
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
            <Button type="submit" disabled={busy || hosts.length === 0}>
              {busy ? "Creating…" : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
