import { StatCard } from "@/components/ui";
import { formatNgn } from "@/lib/utils/money";
import type { ConnectionWithNeighbor } from "@/lib/hooks/host/useConnections";
import type { EarningsSummary } from "@/lib/hooks/host/useEarnings";
import type { HostTelemetryStats } from "@/lib/hooks/host/useHostTelemetry";

interface StatGridProps {
  connections: ConnectionWithNeighbor[];
  earnings?: EarningsSummary | null;
  telemetry?: HostTelemetryStats | null;
}

export function StatGrid({ connections, earnings, telemetry }: StatGridProps) {
  const active = connections.filter((c) => c.status === "active").length;
  const total = connections.length;

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <StatCard
        variant="dark"
        label="This week"
        value={earnings ? formatNgn(earnings.period, { compact: true }) : "—"}
        useMono
      />
      <StatCard
        label="Neighbors"
        value={total === 0 ? "0" : `${active} / ${total}`}
        useMono
      />
      <StatCard
        label="Today's earnings"
        value={earnings ? formatNgn(earnings.today, { compact: true }) : "—"}
        useMono
      />
      <StatCard
        label="Generation today"
        value={telemetry ? `${telemetry.kwhToday.toFixed(1)} kWh` : "—"}
        useMono
      />
      <StatCard
        variant="highlight"
        label="Current power"
        value={telemetry ? `${telemetry.currentPowerKw.toFixed(2)} kW` : "—"}
        useMono
      />
      <StatCard
        label="Grid uptime"
        value="99.8%"
        useMono
      />
    </div>
  );
}
