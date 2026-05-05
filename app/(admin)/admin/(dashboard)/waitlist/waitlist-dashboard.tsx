"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Search, X, Phone, Mail, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from "recharts";
import type { WaitlistSubmission, WaitlistStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_VARIANT: Record<WaitlistStatus, "default" | "success" | "warning"> = {
  pending: "default",
  contacted: "warning",
  qualified: "warning",
  converted: "success",
  rejected: "default",
};

const STATUS_OPTIONS: WaitlistStatus[] = ["pending", "contacted", "qualified", "converted", "rejected"];

const PATH_LABELS: Record<string, string> = {
  upgrade_kit: "Upgrade Kit",
  full_stack: "Full Stack",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item) || "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function neighborCountToNumber(val: string | null): number {
  if (!val) return 0;
  if (val === "10+") return 12;
  const parts = val.split("-").map(Number);
  return parts.length === 2 ? (parts[0] + parts[1]) / 2 : parts[0] || 0;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
function WaitlistAnalytics({
  submissions,
  collapsed,
  onToggle,
}: {
  submissions: WaitlistSubmission[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const total = submissions.length;
  const byStatus = countBy(submissions, (s) => s.status);
  const byPath = countBy(submissions, (s) => PATH_LABELS[s.path] ?? s.path);
  const byLga = countBy(submissions, (s) => s.lga);
  const byReferral = countBy(submissions, (s) => s.referral_source ?? "Unknown");
  const byTimeline = countBy(submissions, (s) => s.timeline ?? "Not specified");
  const bySpend = countBy(submissions, (s) => s.monthly_power_spend);
  const droneYes = submissions.filter((s) => s.drone_assessment === "yes").length;

  const avgNeighbors =
    total > 0
      ? (
          submissions.reduce((sum, s) => sum + neighborCountToNumber(s.neighbor_count), 0) / total
        ).toFixed(1)
      : "0";

  // Submissions over time — group by day
  const byDay = useMemo(() => {
    const days: Record<string, number> = {};
    for (const s of submissions) {
      const day = s.created_at.slice(0, 10);
      days[day] = (days[day] ?? 0) + 1;
    }
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [submissions]);

  // Conversion funnel
  const funnel = useMemo(() => {
    const stages: { name: string; count: number; pct: string }[] = [];
    const all = total;
    const contacted = (byStatus.contacted ?? 0) + (byStatus.qualified ?? 0) + (byStatus.converted ?? 0);
    const qualified = (byStatus.qualified ?? 0) + (byStatus.converted ?? 0);
    const converted = byStatus.converted ?? 0;
    stages.push({ name: "Submitted", count: all, pct: "100%" });
    stages.push({ name: "Contacted", count: contacted, pct: all ? `${Math.round((contacted / all) * 100)}%` : "0%" });
    stages.push({ name: "Qualified", count: qualified, pct: all ? `${Math.round((qualified / all) * 100)}%` : "0%" });
    stages.push({ name: "Converted", count: converted, pct: all ? `${Math.round((converted / all) * 100)}%` : "0%" });
    return stages;
  }, [total, byStatus]);

  // Top LGAs for bar chart
  const lgaChart = useMemo(
    () =>
      Object.entries(byLga)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    [byLga],
  );

  const FUNNEL_COLORS = ["#0A2540", "#FFB800", "#FFC933", "#16A34A"];

  return (
    <div className="border border-navy-100 rounded-2xl bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-navy-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-navy-900">Analytics</h2>
          <span className="text-xs font-mono font-bold text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full">
            {total} total
          </span>
        </div>
        {collapsed ? <ChevronDown className="h-5 w-5 text-navy-400" /> : <ChevronUp className="h-5 w-5 text-navy-400" />}
      </button>

      {!collapsed && (
        <div className="px-5 pb-6 space-y-6 border-t border-navy-100 pt-5">
          {/* Row 1: KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(byPath).map(([path, count]) => (
              <div key={path} className="bg-navy-50 rounded-xl p-3">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400">{path}</p>
                <p className="text-2xl font-mono font-bold text-navy-900 mt-1">{count}</p>
                <p className="text-xs text-navy-400">{total ? Math.round((count / total) * 100) : 0}%</p>
              </div>
            ))}
            <div className="bg-navy-50 rounded-xl p-3">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400">Avg Neighbors</p>
              <p className="text-2xl font-mono font-bold text-navy-900 mt-1">{avgNeighbors}</p>
              <p className="text-xs text-navy-400">per submission</p>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400">Drone Requests</p>
              <p className="text-2xl font-mono font-bold text-navy-900 mt-1">{droneYes}</p>
              <p className="text-xs text-navy-400">{total ? Math.round((droneYes / total) * 100) : 0}% of total</p>
            </div>
          </div>

          {/* Row 2: Status badges */}
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-2">By Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <Badge key={s} variant={STATUS_VARIANT[s]} className="text-sm px-3 py-1">
                  {s}: {byStatus[s] ?? 0}
                </Badge>
              ))}
            </div>
          </div>

          {/* Row 3: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LGA demand */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">Top Areas</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lgaChart} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FFB800" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Submissions over time */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">Signups Over Time</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byDay} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#0A2540" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 4: Funnel + breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversion funnel */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">Conversion Funnel</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {funnel.map((_, i) => (
                        <Cell key={i} fill={FUNNEL_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Timeline breakdown */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">Timeline Urgency</p>
              <div className="space-y-2">
                {Object.entries(byTimeline)
                  .sort(([, a], [, b]) => b - a)
                  .map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-navy-700 truncate">{label}</span>
                      <span className="font-mono font-bold text-navy-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Referral breakdown */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">Referral Source</p>
              <div className="space-y-2">
                {Object.entries(byReferral)
                  .sort(([, a], [, b]) => b - a)
                  .map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-navy-700 truncate">{label}</span>
                      <span className="font-mono font-bold text-navy-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Row 5: Monthly spend breakdown */}
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">Monthly Power Spend</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.entries(bySpend)
                .sort(([, a], [, b]) => b - a)
                .map(([label, count]) => (
                  <div key={label} className="bg-navy-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-navy-500 truncate">{label}</p>
                    <p className="text-lg font-mono font-bold text-navy-900">{count}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------
function DetailPanel({
  submission,
  onClose,
  onStatusChange,
}: {
  submission: WaitlistSubmission;
  onClose: () => void;
  onStatusChange: (id: string, status: WaitlistStatus) => void;
}) {
  const s = submission;
  const sections = [
    {
      title: "Contact",
      rows: [
        { icon: <span className="text-navy-400">👤</span>, label: "Name", value: s.full_name },
        { icon: <Phone className="h-3.5 w-3.5 text-navy-400" />, label: "Phone", value: s.phone },
        { icon: <Mail className="h-3.5 w-3.5 text-navy-400" />, label: "Email", value: s.email },
        { icon: <Phone className="h-3.5 w-3.5 text-navy-400" />, label: "WhatsApp", value: s.whatsapp },
      ],
    },
    {
      title: "Property",
      rows: [
        { icon: <MapPin className="h-3.5 w-3.5 text-navy-400" />, label: "Address", value: s.address },
        { icon: <MapPin className="h-3.5 w-3.5 text-navy-400" />, label: "LGA", value: s.lga },
        { label: "Type", value: s.property_type },
        { label: "Ownership", value: s.ownership },
        { label: "Neighbor count", value: s.neighbor_count },
        { label: "Rooftop", value: s.rooftop_access },
      ],
    },
    {
      title: "Power",
      rows: [
        { label: "Path", value: PATH_LABELS[s.path] ?? s.path },
        { label: "Monthly spend", value: s.monthly_power_spend },
        { label: "Primary source", value: s.primary_power_source },
        ...(s.path === "upgrade_kit"
          ? [
              { label: "Panel capacity", value: s.panel_capacity },
              { label: "Inverter", value: s.inverter_model },
              { label: "Battery", value: s.battery_type },
              { label: "System age", value: s.system_age },
              { label: "Surplus", value: s.surplus_power },
            ]
          : []),
      ],
    },
    {
      title: "Investment",
      rows: [
        { label: "Payment", value: s.payment_preference },
        { icon: <Clock className="h-3.5 w-3.5 text-navy-400" />, label: "Timeline", value: s.timeline },
        { label: "Target price", value: s.target_price_per_kwh },
        { label: "Drone assessment", value: s.drone_assessment },
        { label: "Referral", value: s.referral_source },
        { label: "Notes", value: s.notes },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-navy-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-display font-semibold text-lg text-navy-900">{s.full_name}</h3>
            <p className="text-xs text-navy-400 font-mono">{formatDateTime(s.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-navy-50">
            <X className="h-5 w-5 text-navy-400" />
          </button>
        </div>

        {/* Status update */}
        <div className="px-5 py-4 border-b border-navy-100">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-2">
            Update Status
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => onStatusChange(s.id, status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize",
                  s.status === status
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-navy-600 border-navy-100 hover:border-navy-300",
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="px-5 py-4 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-navy-400 mb-3">
                {section.title}
              </p>
              <div className="space-y-2">
                {section.rows
                  .filter((r) => r.value)
                  .map((r) => (
                    <div key={r.label} className="flex items-start gap-2">
                      {"icon" in r && r.icon ? <span className="mt-0.5 flex-shrink-0">{r.icon}</span> : null}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400">{r.label}</p>
                        <p className="text-sm text-navy-900 break-words">{r.value}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export function WaitlistDashboard({
  submissions: initialSubmissions,
}: {
  submissions: WaitlistSubmission[];
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | "all">("all");
  const [pathFilter, setPathFilter] = useState<string>("all");
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setUpdatingStatus] = useState<string | null>(null);

  // Filters
  const filtered = useMemo(() => {
    let list = submissions;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (pathFilter !== "all") list = list.filter((s) => s.path === pathFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.lga.toLowerCase().includes(q) ||
          (s.email && s.email.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [submissions, statusFilter, pathFilter, search]);

  const selected = selectedId ? submissions.find((s) => s.id === selectedId) ?? null : null;

  async function handleStatusChange(id: string, newStatus: WaitlistStatus) {
    setUpdatingStatus(id);
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
      );
    } catch {
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Analytics */}
      <WaitlistAnalytics
        submissions={submissions}
        collapsed={analyticsCollapsed}
        onToggle={() => setAnalyticsCollapsed((c) => !c)}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search name, phone, area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-[12px] border border-navy-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WaitlistStatus | "all")}
          className="h-10 px-3 rounded-[12px] border border-navy-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 cursor-pointer"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select
          value={pathFilter}
          onChange={(e) => setPathFilter(e.target.value)}
          className="h-10 px-3 rounded-[12px] border border-navy-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 cursor-pointer"
        >
          <option value="all">All paths</option>
          <option value="upgrade_kit">Upgrade Kit</option>
          <option value="full_stack">Full Stack</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-xs font-mono text-navy-400">
        Showing {filtered.length} of {submissions.length}
      </p>

      {/* Table */}
      <div className="border border-navy-100 rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider hidden sm:table-cell">Area</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider hidden md:table-cell">Path</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider hidden lg:table-cell">Monthly Spend</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider hidden lg:table-cell">Timeline</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-navy-400">
                    No submissions match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="border-b border-navy-50 hover:bg-navy-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-navy-900 truncate max-w-[160px]">{s.full_name}</td>
                  <td className="px-4 py-3 font-mono text-navy-600 text-xs">{s.phone}</td>
                  <td className="px-4 py-3 text-navy-600 hidden sm:table-cell">{s.lga}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-md text-xs font-medium",
                      s.path === "full_stack" ? "bg-navy-100 text-navy-700" : "bg-yellow-100 text-yellow-800",
                    )}>
                      {PATH_LABELS[s.path] ?? s.path}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-600 text-xs hidden lg:table-cell">{s.monthly_power_spend}</td>
                  <td className="px-4 py-3 text-navy-600 text-xs hidden lg:table-cell">{s.timeline ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[s.status]} className="capitalize text-xs">
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-navy-400 text-xs font-mono hidden sm:table-cell">{formatDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          submission={selected}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
