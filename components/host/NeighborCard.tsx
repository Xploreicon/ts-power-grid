import Link from "next/link";
import { Badge } from "@/components/ui";
import type { ConnectionWithNeighbor } from "@/lib/hooks/host/useConnections";

interface NeighborCardProps {
  connection: ConnectionWithNeighbor;
}

export function NeighborCard({ connection }: NeighborCardProps) {
  const { neighbor, meter, status, current_price_per_kwh } = connection;

  const initials =
    neighbor.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "N";

  const displayName = neighbor.full_name ?? neighbor.phone ?? "Unknown";

  return (
    <Link
      href={`/host/neighbors/${connection.id}`}
      className="flex items-center gap-4 bg-white rounded-[12px] p-4 border border-navy-100 hover:border-navy-300 active:scale-[0.98] transition-all"
    >
      <div className="h-10 w-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 text-sm font-bold flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-navy-900 truncate">{displayName}</p>
        <p className="text-xs text-navy-400 font-mono mt-0.5">
          {meter.serial_number} &middot; ₦{Number(current_price_per_kwh).toFixed(2)}/kWh
        </p>
      </div>
      <Badge
        variant={
          status === "active"
            ? "success"
            : status === "suspended"
              ? "warning"
              : "default"
        }
        dot={status === "active"}
        pulse={status === "active"}
        className="flex-shrink-0"
      >
        {status}
      </Badge>
    </Link>
  );
}
