"use client";

import { useEffect, useState } from "react";
import type { Summary } from "../../data/schema.ts";
import { REVIEW_THRESHOLD } from "./constants";
import { getReviewCount } from "./catalog";

// Client-side cache + in-flight dedup, keyed by sku. Module scope so a
// prefetch fired from the wishlist page (on selection confirm) and the
// compare page's own mount both land in the same cache — whichever runs
// first does the fetch, the other just reads the result.
const cache = new Map<string, Summary>();
const inFlight = new Map<string, Promise<void>>();

/** ACCEPTANCE 5.5: below-threshold SKUs must never appear in the outbound
 * request at all, not just be handled specially once the server sees
 * them — filter client-side before any fetch happens. */
function eligibleSkus(skus: string[]): string[] {
  return skus.filter((sku) => getReviewCount(sku) >= REVIEW_THRESHOLD);
}

/** Below-threshold SKUs are deliberately never fetched (RULES C1 — no LLM
 * call, ever), so they'd otherwise sit in `cache` as permanently missing
 * and read as "still loading" forever instead of the honest empty state.
 * The client already knows the review count locally, so this needs no
 * network round-trip. */
function resolveSummary(sku: string): Summary | undefined {
  const cached = cache.get(sku);
  if (cached) return cached;
  const count = getReviewCount(sku);
  if (count < REVIEW_THRESHOLD) {
    return { sku, status: "insufficient_reviews", themes: [], source: "fallback", basedOn: count };
  }
  return undefined; // genuinely still loading
}

function fetchBatch(skus: string[]): Promise<void> {
  const uncached = skus.filter((sku) => !cache.has(sku) && !inFlight.has(sku));
  if (uncached.length === 0) return Promise.resolve();

  const promise = fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus: uncached }),
  })
    .then((res) => res.json())
    .then((data: { summaries: Summary[] }) => {
      for (const s of data.summaries) cache.set(s.sku, s);
    })
    .catch((e) => {
      console.error("[summaries] fetch failed", e);
    })
    .finally(() => {
      for (const sku of uncached) inFlight.delete(sku);
    });

  for (const sku of uncached) inFlight.set(sku, promise);
  return promise;
}

/** Fire-and-forget prefetch — call the moment selection is confirmed
 * (ARCHITECTURE §2: "the moment the user confirms their selection, fire
 * one POST for all 2-4 SKUs in parallel while the deck-entry animation
 * plays"), so summaries are usually in by the time card 1 is interactive. */
export function prefetchSummaries(skus: string[]): void {
  void fetchBatch(eligibleSkus(skus));
}

export function useSummaries(skus: string[]): {
  summaries: Record<string, Summary | undefined>;
  loading: boolean;
} {
  const [, bump] = useState(0);
  const eligible = eligibleSkus(skus);
  const key = eligible.join(",");

  useEffect(() => {
    let cancelled = false;
    fetchBatch(eligible).then(() => {
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const summaries: Record<string, Summary | undefined> = {};
  for (const sku of skus) summaries[sku] = resolveSummary(sku);
  const loading = eligible.some((sku) => !cache.has(sku));

  return { summaries, loading };
}
