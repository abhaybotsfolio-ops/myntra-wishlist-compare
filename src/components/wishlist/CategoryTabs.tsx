"use client";

import type { ViewCategory } from "@/lib/store";

const TABS: { value: ViewCategory; label: string }[] = [
  { value: "all", label: "All Items" },
  { value: "shirts", label: "Shirts" },
  { value: "pants", label: "Pants" },
];

/** R1: locked (non-interactive, but still shows the active tab) while
 * selecting — BUILD_PLAN Phase 4: "tabs are locked while selecting", which
 * is what makes cross-category selection impossible by construction. */
export function CategoryTabs({
  active,
  onChange,
  locked,
}: {
  active: ViewCategory;
  onChange: (c: ViewCategory) => void;
  locked: boolean;
}) {
  return (
    <div role="tablist" aria-label="Wishlist category" className="flex gap-2 px-4 pt-3">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={locked || undefined}
            disabled={locked}
            onClick={() => onChange(tab.value)}
            className={[
              "min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
              isActive ? "bg-ink text-white" : "bg-canvas text-ink-muted",
              locked ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
