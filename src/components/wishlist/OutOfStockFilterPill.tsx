"use client";

import { PackageX } from "lucide-react";

/**
 * A real, inventory-backed toggle (not decorative) — composes with the
 * category tabs (AND), and locks while selecting for the same reason the
 * category tabs do: the eligible set must stay stable mid-selection.
 */
export function OutOfStockFilterPill({
  active,
  onChange,
  locked,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  locked: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-disabled={locked || undefined}
      disabled={locked}
      onClick={() => onChange(!active)}
      className={[
        "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-muted",
        locked ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <PackageX className="h-3.5 w-3.5" aria-hidden="true" />
      Out of Stock
    </button>
  );
}
