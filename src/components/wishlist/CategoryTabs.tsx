"use client";

import type { ComponentType } from "react";
import { LayoutGrid, Shirt } from "lucide-react";
import type { ViewCategory } from "@/lib/store";

// No lucide-react icon exists for "pants"/"trousers" — a small inline
// silhouette instead, echoing the same waistband/fly/two-legs shape
// scripts/generate-seed.ts's own pantsSvg placeholder art already uses,
// so the glyph family stays visually consistent with the product imagery.
function PantsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 3h12l1 5-3.2 13h-2.3L12 9l-1.5 12H8.2L5 8l1-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS: { value: ViewCategory; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All Items", Icon: LayoutGrid },
  { value: "shirts", label: "Shirts", Icon: Shirt },
  { value: "pants", label: "Pants", Icon: PantsGlyph },
];

/**
 * Circle-icon rail, restyled from the original pill row toward the
 * reference Myntra screenshot's category rail — but RULES B1 forbids any
 * category beyond Shirts/Pants (and the combined "All Items" view) showing
 * up anywhere in the UI, including chips, so this stays exactly the same
 * three values as before. `role`, `aria-selected`, `aria-disabled` and the
 * visible label text are unchanged from the previous pill implementation
 * (existing acceptance tests assert on them) — only the internal layout
 * changed from a horizontal pill to an icon-over-label circle.
 */
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
    <div role="tablist" aria-label="Wishlist category" className="flex gap-5 px-4 pt-3">
      {TABS.map(({ value, label, Icon }) => {
        const isActive = value === active;
        return (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={locked || undefined}
            disabled={locked}
            onClick={() => onChange(value)}
            className={[
              "flex min-h-11 flex-col items-center gap-1 transition-colors",
              locked ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors ${
                isActive ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={`text-[11px] font-semibold ${isActive ? "text-ink" : "text-ink-muted"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
