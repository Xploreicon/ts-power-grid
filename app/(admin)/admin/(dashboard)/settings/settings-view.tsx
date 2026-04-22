"use client";

import * as React from "react";
import { toast } from "sonner";
import { Shield, Users, Sliders, MessageSquare, Key } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn } from "@/lib/utils/cn";

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};
type ConfigRow = { key: string; value: unknown; updated_at: string };
type Template = {
  id: string;
  channel: string;
  name: string;
  body: string;
  updated_at: string;
};

type Tab = "team" | "config" | "templates" | "api";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "team", label: "Team", icon: Users },
    { id: "config", label: "Platform config", icon: Sliders },
    { id: "templates", label: "Notification templates", icon: MessageSquare },
    { id: "api", label: "API keys", icon: Key },
  ];

export function SettingsView({
  role,
  team,
  config,
  templates,
}: {
  role: "admin" | "super_admin";
  team: TeamMember[];
  config: ConfigRow[];
  templates: Template[];
}) {
  const [tab, setTab] = React.useState<Tab>("team");
  const isSuper = role === "super_admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-navy-700/70">
            Manage admin team, platform config, notification templates, and
            integration keys.
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
            isSuper
              ? "bg-yellow-500 text-navy-950"
              : "bg-navy-100 text-navy-700",
          )}
        >
          <Shield className="h-3.5 w-3.5" /> {isSuper ? "Super admin" : "Admin"}
        </span>
      </div>

      <div className="rounded-2xl border border-navy-100 bg-white">
        <nav className="flex gap-1 border-b border-navy-100 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold",
                tab === t.id
                  ? "bg-navy-950 text-white"
                  : "text-navy-700 hover:bg-offwhite",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="p-5">
          {tab === "team" ? (
            <TeamTab team={team} isSuper={isSuper} />
          ) : tab === "config" ? (
            <ConfigTab rows={config} isSuper={isSuper} />
          ) : tab === "templates" ? (
            <TemplatesTab templates={templates} />
          ) : (
            <ApiKeysTab isSuper={isSuper} />
          )}
        </div>
      </div>
    </div>
  );
}

function TeamTab({ team, isSuper }: { team: TeamMember[]; isSuper: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Admin team</h2>
        {isSuper ? (
          <button
            type="button"
            onClick={() => toast.info("Invite flow — TODO: requires re-auth")}
            className="rounded-lg bg-navy-950 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Invite admin
          </button>
        ) : null}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wider text-navy-700/60">
            <th className="py-2">Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {team.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-navy-700/40">
                No admin users yet.
              </td>
            </tr>
          ) : (
            team.map((m) => (
              <tr key={m.id} className="border-b border-navy-100 last:border-0">
                <td className="py-3 font-medium">{m.full_name ?? "—"}</td>
                <td>{m.email ?? "—"}</td>
                <td className="font-mono text-xs">{m.phone ?? "—"}</td>
                <td>
                  <StatusBadge status={m.role} />
                </td>
                <td className="text-xs text-navy-700/60">
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConfigTab({ rows, isSuper }: { rows: ConfigRow[]; isSuper: boolean }) {
  // Seed expected keys even if the row is missing so ops sees the full matrix.
  const EXPECTED = [
    { key: "platform_fee_bps", label: "Platform fee (bps)", hint: "100 = 1%" },
    { key: "price_per_kwh_kobo", label: "Price per kWh (kobo)", hint: "28_000 = ₦280" },
    { key: "low_balance_threshold_kobo", label: "Low balance threshold (kobo)", hint: "₦500 default" },
    { key: "disconnect_grace_minutes", label: "Disconnect grace (min)", hint: "Grace after balance hits zero" },
    { key: "max_withdrawal_auto_kobo", label: "Auto-approve withdrawal ceiling (kobo)", hint: "Above this, manual review" },
  ];
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Platform config</h2>
        <p className="text-sm text-navy-700/60">
          Every change is logged to <code>billing_audit</code> and requires a
          reason. {isSuper ? null : "Only super admins can mutate."}
        </p>
      </div>
      <div className="space-y-2">
        {EXPECTED.map((e) => {
          const row = byKey.get(e.key);
          return (
            <ConfigRowEditor
              key={e.key}
              configKey={e.key}
              label={e.label}
              hint={e.hint}
              value={row?.value}
              updatedAt={row?.updated_at}
              isSuper={isSuper}
            />
          );
        })}
      </div>
    </div>
  );
}

function ConfigRowEditor({
  configKey,
  label,
  hint,
  value,
  updatedAt,
  isSuper,
}: {
  configKey: string;
  label: string;
  hint: string;
  value: unknown;
  updatedAt?: string;
  isSuper: boolean;
}) {
  const [draft, setDraft] = React.useState(
    value == null ? "" : String(value),
  );
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const dirty = String(draft) !== (value == null ? "" : String(value));

  async function save() {
    if (!reason.trim()) {
      toast.error("Reason required for config changes");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: configKey, value: draft, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Saved");
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-navy-100 bg-offwhite/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-navy-950">{label}</p>
          <p className="text-xs text-navy-700/60">{hint}</p>
        </div>
        {updatedAt ? (
          <p className="text-[10px] uppercase tracking-wider text-navy-700/40">
            Updated {new Date(updatedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-[10px] uppercase tracking-wider text-amber">
            No value set
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          disabled={!isSuper || saving}
          onChange={(e) => setDraft(e.target.value)}
          className="w-48 rounded-lg border border-navy-100 bg-white px-3 py-1.5 font-mono text-sm disabled:opacity-50"
        />
        {dirty ? (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="flex-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm"
          />
        ) : null}
        <button
          type="button"
          disabled={!isSuper || !dirty || saving}
          onClick={save}
          className="rounded-lg bg-navy-950 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function TemplatesTab({ templates }: { templates: Template[] }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Notification templates
      </h2>
      <p className="text-sm text-navy-700/60">
        WhatsApp templates must be separately approved by Meta. SMS/email
        templates can be edited inline.
      </p>
      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-100 p-8 text-center text-sm text-navy-700/50">
          No templates yet. Seed via{" "}
          <code>notification_templates</code> table.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <details
              key={t.id}
              className="rounded-lg border border-navy-100 bg-offwhite/50 p-4 open:bg-white"
            >
              <summary className="cursor-pointer select-none">
                <span className="font-medium text-navy-950">{t.name}</span>{" "}
                <StatusBadge status={t.channel} />
                <span className="ml-2 text-xs text-navy-700/60">
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </span>
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-navy-950 p-3 text-xs text-yellow-500">
                {t.body}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeysTab({ isSuper }: { isSuper: boolean }) {
  const INTEGRATIONS = [
    { name: "Paystack", env: "PAYSTACK_SECRET_KEY", status: "connected" },
    { name: "Termii SMS", env: "TERMII_API_KEY", status: "connected" },
    { name: "WhatsApp Business", env: "WHATSAPP_ACCESS_TOKEN", status: "connected" },
    { name: "Supabase", env: "SUPABASE_SERVICE_ROLE_KEY", status: "connected" },
  ];
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">API keys</h2>
      <p className="text-sm text-navy-700/60">
        Read-only view. Keys live in environment variables — rotate via
        deployment platform.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wider text-navy-700/60">
            <th className="py-2">Integration</th>
            <th>Env var</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {INTEGRATIONS.map((i) => (
            <tr key={i.env} className="border-b border-navy-100 last:border-0">
              <td className="py-3 font-medium">{i.name}</td>
              <td>
                <code className="rounded bg-navy-100 px-1.5 py-0.5 text-xs">
                  {i.env}
                </code>
              </td>
              <td>
                <StatusBadge status={i.status} />
              </td>
              <td className="text-right">
                <button
                  type="button"
                  disabled={!isSuper}
                  onClick={() => toast.info("Rotation must happen in Vercel / CLI")}
                  className="rounded-lg border border-navy-100 bg-white px-3 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  Rotate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
