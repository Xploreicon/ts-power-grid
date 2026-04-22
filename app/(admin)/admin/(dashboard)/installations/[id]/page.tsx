import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";

const MapView = dynamic(
  () => import("@/components/admin/map-view").then((m) => m.MapView),
  { ssr: false },
);

export const dynamicParams = true;

export default async function InstallationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("installations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  const equipment = (data.equipment_list as Array<{
    name: string;
    qty: number;
    sku?: string;
  }> | null) ?? [];
  const checklist = (data.pre_install_checklist as Array<{
    task: string;
    done: boolean;
  }> | null) ?? DEFAULT_CHECKLIST;
  const verification = (data.post_install_verification as Record<
    string,
    unknown
  > | null) ?? {};

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-navy-700/60">
              Installation
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {(data.customer_name as string) ?? "Unknown customer"}
            </h1>
            <p className="mt-1 text-navy-700/70">
              {(data.address as string) ?? ""}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={(data.stage as string) ?? "unknown"} />
              <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-navy-700">
                {(data.path_type as string)?.replace(/_/g, " ") ?? "—"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-navy-700/60">Contract value</div>
            <div className="font-mono text-2xl font-semibold">
              {formatNgnKobo(Number(data.amount ?? 0))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-navy-100 bg-white p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Site location</h2>
          <div className="mt-3">
            {data.latitude != null && data.longitude != null ? (
              <MapView
                center={[
                  Number(data.latitude),
                  Number(data.longitude),
                ]}
                zoom={15}
                height={280}
                markers={[
                  {
                    id: params.id,
                    lat: Number(data.latitude),
                    lng: Number(data.longitude),
                    label: (data.customer_name as string) ?? "Site",
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-navy-700/60">No coordinates set.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Schedule & crew</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy-700/60">
                Scheduled
              </dt>
              <dd className="font-mono">
                {data.scheduled_at
                  ? format(
                      new Date(data.scheduled_at as string),
                      "d MMM yyyy HH:mm",
                    )
                  : "Unscheduled"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy-700/60">
                Technician
              </dt>
              <dd className="font-mono">
                {(data.assigned_technician as string) ?? "Unassigned"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Equipment</h2>
          {equipment.length === 0 ? (
            <p className="mt-2 text-sm text-navy-700/60">
              No equipment assigned yet.
            </p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-navy-700/60">
                <tr>
                  <th className="py-2">SKU</th>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e, i) => (
                  <tr key={i} className="border-t border-navy-100">
                    <td className="py-1.5 font-mono text-xs">{e.sku ?? "—"}</td>
                    <td>{e.name}</td>
                    <td className="text-right font-mono">{e.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Checklist</h2>
          <ul className="mt-3 space-y-2">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={c.done}
                  className="rounded"
                />
                <span>{c.task}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-navy-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">
          Post-install verification
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <VerifyItem
            label="Gateway online"
            done={!!verification.gateway_online}
          />
          <VerifyItem
            label="Meter readings received"
            done={!!verification.meter_readings_received}
          />
          <VerifyItem
            label="Photos uploaded"
            done={!!verification.photos_uploaded}
          />
        </dl>
      </div>
    </div>
  );
}

const DEFAULT_CHECKLIST = [
  { task: "Confirm roof access with host", done: false },
  { task: "Site survey signed off", done: false },
  { task: "Equipment loaded on truck", done: false },
  { task: "Gateway provisioned with site_id", done: false },
  { task: "Meters serialised and allocated", done: false },
  { task: "Pre-install photos taken", done: false },
];

function VerifyItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-offwhite p-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${done ? "bg-green" : "bg-navy-700/30"}`}
      />
      <span>{label}</span>
    </div>
  );
}
