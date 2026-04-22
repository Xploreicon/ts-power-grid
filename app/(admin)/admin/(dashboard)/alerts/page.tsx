import { AlertsFullFeed } from "./alerts-full-feed";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-navy-700/70">
          Live feed of open disputes, offline gateways, and overdue
          installments. Polled every 30 seconds, with real-time pulses on new
          disputes.
        </p>
      </div>
      <AlertsFullFeed />
    </div>
  );
}
