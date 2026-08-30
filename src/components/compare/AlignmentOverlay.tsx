"use client";

import { useEffect, useState } from "react";
import { ATTRIBUTE_ROWS } from "@/lib/constants";

/**
 * Dev-only, toggled by 'g' (myntra-ui skill, BUILD_PLAN Phase 5). Measures
 * the row boundaries of whichever card is frontmost at toggle time and
 * draws them as viewport-fixed guide lines — swipe to another card and any
 * row that doesn't land on its guide is an alignment regression, visible
 * instead of subtle.
 */
export function AlignmentOverlay() {
  const [visible, setVisible] = useState(false);
  const [tops, setTops] = useState<Record<string, number>>({});

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      setVisible((v) => !v);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const next: Record<string, number> = {};
    for (const row of ATTRIBUTE_ROWS) {
      const el = document.querySelector(`[data-row="${row.key}"]`);
      if (el) next[row.key] = el.getBoundingClientRect().top;
    }
    setTops(next);
  }, [visible]);

  if (process.env.NODE_ENV !== "development" || !visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[999]">
      {ATTRIBUTE_ROWS.map(
        (row) =>
          tops[row.key] !== undefined && (
            <div
              key={row.key}
              className="absolute inset-x-0 border-t border-brand/50"
              style={{ top: tops[row.key] }}
            >
              <span className="bg-brand/80 px-1 text-[9px] font-mono text-white">
                {row.key}
              </span>
            </div>
          ),
      )}
    </div>
  );
}
