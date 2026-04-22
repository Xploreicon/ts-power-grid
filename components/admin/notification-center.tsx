"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CircleDot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { cn } from "@/lib/utils/cn";

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  const unreadCount = notifications.filter((a) => !a.read_at).length;
  const displayed = notifications.slice(0, 8);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-notification-center]")) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div className="relative" data-notification-center>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-navy-700 hover:bg-offwhite"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-1 w-96 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-navy-950">
                Notifications
              </p>
              <p className="text-xs text-navy-700/60">
                {unreadCount} unread
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-xs font-semibold text-yellow-500 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-navy-100 overflow-y-auto">
            {displayed.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-navy-700/40">
                All clear.
              </li>
            ) : (
              displayed.map((a) => {
                const isRead = !!a.read_at;
                const href = a.data?._url;
                const body = (
                  <>
                    <div className="flex items-start gap-2">
                      <CircleDot
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-700",
                          isRead && "opacity-30",
                        )}
                      />
                      <div className="flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isRead
                              ? "text-navy-700/60"
                              : "text-navy-950",
                          )}
                        >
                          {a.title}
                        </p>
                        {a.body ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-navy-700/60">
                            {a.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-navy-700/40">
                          {formatDistanceToNow(new Date(a.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </>
                );
                return (
                  <li key={a.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          if (!isRead) markAsRead(a.id);
                          setOpen(false);
                        }}
                        className="block px-4 py-3 hover:bg-offwhite"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div 
                        className="cursor-pointer px-4 py-3 hover:bg-offwhite"
                        onClick={() => {
                          if (!isRead) markAsRead(a.id);
                        }}
                      >
                        {body}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
