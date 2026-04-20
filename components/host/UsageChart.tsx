"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { koboToNgn } from "@/lib/utils/money";
import type { EarningsDay } from "@/lib/hooks/host/useEarnings";

interface UsageChartProps {
  data: EarningsDay[];
  className?: string;
}

export function UsageChart({ data, className }: UsageChartProps) {
  const chartData = data.map((d) => ({
    day: d.day,
    earnings: parseFloat(koboToNgn(d.total).toFixed(2)),
  }));

  return (
    <div
      className={`bg-white rounded-[12px] p-4 border border-navy-100 ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
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
          <YAxis hide />
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
            cursor={{ fill: "rgba(10,37,64,0.04)" }}
          />
          <Bar dataKey="earnings" fill="#0A2540" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
