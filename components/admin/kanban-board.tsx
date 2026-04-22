"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface KanbanCard {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  ageDays?: number;
  stage: string;
  href?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  tone?: "neutral" | "attention" | "good";
}

/**
 * Lightweight Kanban board with native HTML drag-and-drop (no deps).
 * Triggers onMove when a card lands in a new column. Visual grouping only
 * — persistence + audit logging is up to the parent.
 */
export function KanbanBoard({
  columns,
  cards,
  onMove,
  onCardClick,
}: {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove?: (cardId: string, toStage: string) => void | Promise<void>;
  onCardClick?: (card: KanbanCard) => void;
}) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overColumn, setOverColumn] = React.useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colCards = cards.filter((c) => c.stage === col.id);
        const isOver = overColumn === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(col.id);
            }}
            onDragLeave={() => setOverColumn(null)}
            onDrop={async () => {
              setOverColumn(null);
              if (draggingId) {
                await onMove?.(draggingId, col.id);
              }
              setDraggingId(null);
            }}
            className={cn(
              "flex min-h-[400px] w-72 shrink-0 flex-col rounded-xl border bg-offwhite p-3",
              isOver
                ? "border-yellow-500 bg-yellow-500/5"
                : "border-navy-100",
            )}
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-navy-700">
                {col.title}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-mono font-semibold text-navy-700">
                {colCards.length}
              </span>
            </header>
            <div className="flex flex-col gap-2">
              {colCards.map((card) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={() => setDraggingId(card.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onCardClick?.(card)}
                  className={cn(
                    "cursor-grab rounded-lg border border-navy-100 bg-white p-3 shadow-sm transition-shadow hover:shadow",
                    draggingId === card.id && "opacity-50",
                    onCardClick && "cursor-pointer",
                  )}
                >
                  <div className="text-sm font-semibold text-navy-950">
                    {card.title}
                  </div>
                  {card.subtitle ? (
                    <div className="mt-0.5 text-xs text-navy-700/70">
                      {card.subtitle}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-navy-700/60">
                    {card.meta ? (
                      <span className="font-mono">{card.meta}</span>
                    ) : (
                      <span />
                    )}
                    {card.ageDays != null ? (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono font-semibold",
                          card.ageDays > 14
                            ? "bg-red/10 text-red"
                            : card.ageDays > 7
                              ? "bg-amber/10 text-amber"
                              : "bg-navy-100 text-navy-700",
                        )}
                      >
                        {card.ageDays}d
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
              {colCards.length === 0 ? (
                <div className="rounded-lg border border-dashed border-navy-100 p-4 text-center text-xs text-navy-700/50">
                  Drop here
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
