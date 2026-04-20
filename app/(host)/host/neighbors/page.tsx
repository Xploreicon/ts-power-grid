"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { useConnections } from "@/lib/hooks/host/useConnections";
import { useRealtimeConnections } from "@/lib/hooks/host/useRealtimeConnections";
import { NeighborCard } from "@/components/host/NeighborCard";
import { Button, Skeleton } from "@/components/ui";

export default function NeighborsPage() {
  const { data: connections, isLoading } = useConnections();
  useRealtimeConnections();

  const active = (connections ?? []).filter((c) => c.status === "active");
  const inactive = (connections ?? []).filter((c) => c.status !== "active");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
            Host Dashboard
          </p>
          <h1 className="text-2xl font-display font-bold text-navy-900">
            Neighbors
          </h1>
        </div>
        <Button asChild size="sm">
          <Link href="/host/neighbors/new">
            <UserPlus className="h-4 w-4 mr-2" />
            Add
          </Link>
        </Button>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-[12px]" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (connections ?? []).length === 0 && (
        <div className="text-center py-16">
          <div className="h-14 w-14 rounded-full bg-navy-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-6 w-6 text-navy-400" strokeWidth={1.5} />
          </div>
          <h2 className="font-display text-lg font-bold text-navy-900">
            No neighbors yet
          </h2>
          <p className="text-navy-400 text-sm mt-1 max-w-xs mx-auto">
            Connect your first neighbor to start earning from your solar
            installation.
          </p>
          <Button asChild className="mt-4">
            <Link href="/host/neighbors/new">Add First Neighbor</Link>
          </Button>
        </div>
      )}

      {/* Active neighbors */}
      {active.length > 0 && (
        <section className="mb-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
            Active · {active.length}
          </h2>
          <div className="space-y-2">
            {active.map((c) => (
              <NeighborCard key={c.id} connection={c} />
            ))}
          </div>
        </section>
      )}

      {/* Inactive / suspended neighbors */}
      {inactive.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
            Inactive · {inactive.length}
          </h2>
          <div className="space-y-2">
            {inactive.map((c) => (
              <NeighborCard key={c.id} connection={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
