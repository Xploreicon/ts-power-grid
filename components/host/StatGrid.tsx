import { StatCard } from "@/components/ui";
import { formatNgn } from "@/lib/utils/money";
import type { ConnectionWithNeighbor } from "@/lib/hooks/host/useConnections";
import type { EarningsSummary } from "@/lib/hooks/host/useEarnings";

interface StatGridProps {
  connections: ConnectionWithNeighbor[];
  earnings?: EarningsSummary | null;
}

export function StatGrid({ connections, earnings }: StatGridProps) {
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
        variant="highlight"
        label="Grid uptime"
        value="99.8%"
        useMono
      />
    </div>
  );
}
