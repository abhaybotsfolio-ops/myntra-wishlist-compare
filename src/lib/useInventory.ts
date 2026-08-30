"use client";

import { useEffect, useRef, useState } from "react";
import type { Inventory } from "../../data/schema.ts";
import { INVENTORY_POLL_MS } from "./constants";
import { track } from "./track";
import { showToast } from "./toast-bus";

interface RecommendedMeta {
  size: string;
  brand: string;
}

/**
 * size-wedge skill, concern 3. Polls /api/inventory every 8s, mounted only
 * while /compare is (the caller controls that by only rendering this
 * hook's consumer there), paused whenever the tab is hidden — no timer
 * runs at all while hidden, not just a skipped fetch, so ACCEPTANCE 4.8's
 * "check the network panel" has literally nothing to see. Diffs against
 * the previous poll and only fires stock_changed_in_session / the toast
 * for the size a card actually cares about (its recommended size), not
 * every size that happens to move.
 */
export function useInventory(
  skus: string[],
  deckStartedAt: number | null,
  recommendedBySku: Record<string, RecommendedMeta>,
) {
  const [inventory, setInventory] = useState<Inventory>({});
  const [loaded, setLoaded] = useState(false);
  const prevRef = useRef<Inventory>({});
  const timerRef = useRef<number | undefined>(undefined);
  const skusKey = skus.join(",");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return; // truly paused — no fetch, no reschedule
      try {
        const params = new URLSearchParams({ skus: skusKey });
        if (deckStartedAt) params.set("deckStartedAt", String(deckStartedAt));
        const res = await fetch(`/api/inventory?${params.toString()}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: { inventory: Inventory } = await res.json();
        if (cancelled) return;

        for (const [sku, sizes] of Object.entries(data.inventory)) {
          const meta = recommendedBySku[sku];
          if (!meta) continue;
          const prevUnits = prevRef.current[sku]?.[meta.size];
          const nextUnits = sizes[meta.size];
          if (prevUnits !== undefined && nextUnits !== undefined && prevUnits !== nextUnits) {
            track("stock_changed_in_session", { sku, size: meta.size, from: prevUnits, to: nextUnits });
            if (nextUnits <= 0 && prevUnits > 0) {
              showToast(`Size ${meta.size} just went out of stock for the ${meta.brand} item`, {
                tone: "warning",
              });
            }
          }
        }
        prevRef.current = data.inventory;
        setInventory(data.inventory);
        setLoaded(true);
      } catch (e) {
        console.error("[useInventory] poll failed", e);
      } finally {
        if (!cancelled && !document.hidden) {
          timerRef.current = window.setTimeout(poll, INVENTORY_POLL_MS);
        }
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) {
        window.clearTimeout(timerRef.current);
        poll();
      } else {
        window.clearTimeout(timerRef.current);
      }
    }

    poll();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skusKey, deckStartedAt]);

  return { inventory, loaded };
}
