/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { savePreferences } from "@/app/actions/save-preferences";

interface Props {
  initialPreferences: Record<string, boolean>;
}

const EVENTS = [
  { id: "neighbor_topup_received", label: "Neighbor tops up" },
  { id: "daily_earnings_summary", label: "Daily earnings summary" },
  { id: "system_health_alert", label: "System health alerts" },
  { id: "withdrawal_confirmation", label: "Withdrawals" },
];

const CHANNELS = [
  { id: "push", label: "Push" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
];

export function NotificationsView({ initialPreferences }: Props) {
  const [prefs, setPrefs] = React.useState(initialPreferences);
  const [saving, setSaving] = React.useState(false);

  const toggle = (eventId: string, channelId: string) => {
    const key = `${eventId}_${channelId}`;
    setPrefs((p) => ({ ...p, [key]: p[key] === false ? true : false }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await savePreferences(prefs);
    setSaving(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Preferences saved");
    }
  };

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications are not supported by your browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permission denied for push notifications.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID key not found");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.toJSON().keys?.p256dh,
            auth: subscription.toJSON().keys?.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (res.ok) {
        toast.success("Push notifications enabled!");
      } else {
        toast.error("Failed to register push subscription.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-navy-100 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-navy-950">Push Notifications</h3>
            <p className="text-sm text-navy-700/70">
              Receive alerts on this device even when the app is closed.
            </p>
          </div>
          <button
            onClick={enablePush}
            className="rounded-lg bg-navy-100 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-navy-100/80"
          >
            Enable for this device
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-offwhite text-navy-700">
              <th className="p-4 font-semibold">Event</th>
              {CHANNELS.map((ch) => (
                <th key={ch.id} className="p-4 text-center font-semibold">
                  {ch.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {EVENTS.map((event) => (
              <tr key={event.id}>
                <td className="p-4 text-navy-950">{event.label}</td>
                {CHANNELS.map((ch) => {
                  const key = `${event.id}_${ch.id}`;
                  // If not explicitly set to false, it's considered true
                  const isChecked = prefs[key] !== false;
                  return (
                    <td key={ch.id} className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(event.id, ch.id)}
                        className="h-4 w-4 rounded border-navy-200 text-yellow-500 focus:ring-yellow-500"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-yellow-500 px-6 py-2.5 font-semibold text-navy-950 hover:bg-yellow-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
