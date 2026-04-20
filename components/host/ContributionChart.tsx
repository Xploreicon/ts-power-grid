"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { koboToNgn } from "@/lib/utils/money";

interface ContributionChartProps {
  data: { name: string; total: number }[];
  className?: string;
}

const COLORS = ["#0A2540", "#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

export function ContributionChart({ data, className }: ContributionChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={`bg-white rounded-[12px] p-8 border border-navy-100 text-center ${className ?? ""}`}
      >
        <p className="text-navy-400 text-sm">No data yet</p>
        <p className="text-navy-300 text-xs mt-1">
          Earnings by neighbor will appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-[12px] p-4 border border-navy-100 ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={52}
            outerRadius={80}
            dataKey="total"
            nameKey="name"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val) => {
              const n = typeof val === "number" ? val : 0;
              return [`₦${koboToNgn(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Earnings"];
            }}
            contentStyle={{
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => (
              <span style={{ fontSize: 12, color: "#475569" }}>{v}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
