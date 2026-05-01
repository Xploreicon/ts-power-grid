"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Renders a UUID in mono font with a click-to-copy button. The full
 * UUID is always copied; we shorten the visible portion when `short`
 * is set so a row doesn't get hijacked by 36 characters of monospace.
 *
 * Used for meter / gateway IDs the operator pastes into the Pi's
 * `config.yaml`. Hovering shows the full string in the title attr so
 * the operator can verify before they copy.
 */
export function CopyableId({
  id,
  short = false,
  className,
}: {
  id: string;
  short?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const display = short ? `…${id.slice(-12)}` : id;

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fall back: select and prompt the user. Most modern browsers
      // (incl. mobile Safari over HTTPS) support clipboard.writeText,
      // so this is rarely hit — but the admin app is also used over
      // weird internal networks where it might be.
      window.prompt("Copy:", id);
    }
  }, [id]);

  return (
    <button
      type="button"
      onClick={onCopy}
      title={id}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md border border-navy-100 bg-offwhite px-2 py-0.5 font-mono text-xs transition hover:bg-yellow-100",
        className,
      )}
    >
      <span>{display}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green" />
      ) : (
        <Copy className="h-3 w-3 text-navy-700/60 group-hover:text-navy-950" />
      )}
    </button>
  );
}
