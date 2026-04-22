"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { formatNgnKobo } from "@/lib/admin/format";

export function RevenueChart({
  data,
}: {
  data: { date: string; kobo: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB800" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#FFB800" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(new Date(d), "d MMM")}
          fontSize={11}
          stroke="#64748b"
        />
        <YAxis
          tickFormatter={(v) => `₦${Math.round(Number(v) / 100 / 1000)}k`}
          fontSize={11}
          stroke="#64748b"
        />
        <Tooltip
          formatter={(v) => formatNgnKobo(Number(v ?? 0))}
          labelFormatter={(d) => format(new Date(d), "d MMM yyyy")}
        />
        <Area
          type="monotone"
          dataKey="kobo"
          stroke="#051530"
          strokeWidth={2}
          fill="url(#revGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
