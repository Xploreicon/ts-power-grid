"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { koboToNgn } from "@/lib/utils/money";
import type { EarningsDay } from "@/lib/hooks/host/useEarnings";

interface EarningsChartProps {
  data: EarningsDay[];
  className?: string;
}

export function EarningsChart({ data, className }: EarningsChartProps) {
  const chartData = data.map((d) => ({
    day: d.day,
    earnings: parseFloat(koboToNgn(d.total).toFixed(2)),
  }));

  return (
    <div
      className={`bg-white rounded-[12px] p-4 border border-navy-100 ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="day"
            tick={{
              fontSize: 11,
              fill: "#64748b",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`
            }
            width={48}
          />
          <Tooltip
            formatter={(val) => {
              const n = typeof val === "number" ? val : 0;
              return [`₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Earnings"];
            }}
            contentStyle={{
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Line
            type="monotone"
            dataKey="earnings"
            stroke="#FFB800"
            strokeWidth={2.5}
            dot={{ fill: "#FFB800", r: 3 }}
            activeDot={{ r: 5, fill: "#FFB800" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
