"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Zap, PhoneCall, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection } from "@/lib/hooks/host/useConnections";
import { useTransactions } from "@/lib/hooks/host/useTransactions";
import { ActivityFeed } from "@/components/host/ActivityFeed";
import { Badge, Button, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export default function NeighborDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: connection, isLoading } = useConnection(id);
  const { data: transactions = [] } = useTransactions(20);
  const [suspending, setSuspending] = useState(false);

  // Filter transactions to only those for this connection
  const connTxns = transactions.filter((t) => t.connection_id === id);

  const handleSuspend = async () => {
    if (!connection) return;
    setSuspending(true);
    try {
      const supabase = createClient();
      const newStatus =
        connection.status === "active" ? "suspended" : "active";
      const { error } = await supabase
        .from("connections")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success(
        newStatus === "suspended"
          ? "Connection suspended"
          : "Connection reactivated",
      );
      queryClient.invalidateQueries({ queryKey: ["connection", id] });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    } catch {
      toast.error("Failed to update connection");
    } finally {
      setSuspending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-navy-300 mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="font-display text-lg font-bold text-navy-900">
          Connection not found
        </h2>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const { neighbor, meter, status, current_price_per_kwh, started_at, pending_phone } =
    connection;
  const displayName = neighbor?.full_name ?? neighbor?.phone ?? pending_phone ?? "Unknown";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-navy-400 hover:text-navy-700 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Neighbors
      </button>

      {/* Profile card */}
      <div className="bg-navy-950 rounded-2xl p-5 text-white mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-yellow-500 flex items-center justify-center text-navy-950 font-bold text-lg">
              {displayName[0]?.toUpperCase() ?? "N"}
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{displayName}</h1>
              {(neighbor?.phone || pending_phone) && (
                <p className="text-navy-400 text-xs font-mono mt-0.5">
                  {neighbor?.phone ?? pending_phone}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant={
              status === "active"
                ? "success"
                : status === "suspended" || status === "pending"
                  ? "warning"
                  : "default"
            }
            dot={status === "active"}
            pulse={status === "active"}
          >
            {status === "pending" ? "Pending signup" : status}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-navy-800">
          <div>
            <p className="text-navy-400 text-[10px] font-mono uppercase tracking-wider">
              Rate
            </p>
            <p className="text-white font-mono font-bold text-sm mt-0.5">
              ₦{Number(current_price_per_kwh).toFixed(2)}/kWh
            </p>
          </div>
          <div>
            <p className="text-navy-400 text-[10px] font-mono uppercase tracking-wider">
              Meter
            </p>
            <p className="text-white font-mono font-bold text-sm mt-0.5 truncate">
              {meter.serial_number}
            </p>
          </div>
          <div>
            <p className="text-navy-400 text-[10px] font-mono uppercase tracking-wider">
              Since
            </p>
            <p className="text-white font-mono font-bold text-sm mt-0.5">
              {formatDate(started_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Meter status */}
      <div className="bg-white rounded-[12px] border border-navy-100 p-4 mb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
          <Zap className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-navy-900">Smart Meter</p>
          <p className="text-xs text-navy-400 font-mono mt-0.5">
            {meter.serial_number} ·{" "}
            {meter.last_reading_kwh != null
              ? `${meter.last_reading_kwh.toFixed(2)} kWh`
              : "No reading yet"}
          </p>
        </div>
        <Badge variant={meter.status === "active" ? "success" : "warning"}>
          {meter.status}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        {(neighbor?.phone || pending_phone) && (
          <Button variant="secondary" size="sm" asChild className="flex-1">
            <a href={`tel:${neighbor?.phone ?? pending_phone}`}>
              <PhoneCall className="h-4 w-4 mr-2" />
              Call
            </a>
          </Button>
        )}
        <Button
          variant={status === "active" ? "secondary" : "primary"}
          size="sm"
          className={`flex-1 ${status === "active" ? "border-red-200 text-red-600 hover:bg-red-50" : ""}`}
          onClick={handleSuspend}
          disabled={suspending}
        >
          {suspending
            ? "Updating…"
            : status === "active"
              ? "Suspend"
              : "Reactivate"}
        </Button>
      </div>

      {/* Transaction history */}
      <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
        Transactions
      </h2>
      <ActivityFeed
        transactions={connTxns}
        connections={connection ? [connection] : []}
      />
    </div>
  );
}
