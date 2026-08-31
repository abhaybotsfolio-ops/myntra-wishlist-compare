import type { Product } from "../../data/schema.ts";
import type { AvailabilityStatus, SizeRecommendation } from "./size";

export interface PickForYou {
  productId: string;
  reasons: string[]; // e.g. ["your size M is in stock", "rated 4.5★ from 5,230 reviews", "₹600 cheaper than the Van Heusen"]
}

interface SizeInfoLike {
  recommendation: SizeRecommendation | null;
  status: AvailabilityStatus | "loading";
}

/**
 * DECISIONS.md D8 — an explicit, operator-directed override of RULES B3
 * ("no automated winner"). Everything below is computed from real deck
 * data, same discipline as every other derived value in this app (RULES
 * C2/C3 still apply: never a fabricated reason) — the override is about
 * *whether* a verdict is shown at all, not about relaxing the honesty bar
 * once it is.
 *
 * Mirrors the reference prototype's pickForYou(): prefer items available
 * in the shopper's size (falling back to the full set if none are), then
 * highest rating, tie-broken by lower price.
 */
export function computePickForYou(
  products: Product[],
  sizeInfoBySku: Record<string, SizeInfoLike>,
): PickForYou | null {
  if (products.length < 2) return null;

  const inSize = products.filter((p) => {
    const status = sizeInfoBySku[p.id]?.status;
    return status === "available" || status === "low";
  });
  const pool = inSize.length > 0 ? inSize : products;

  let best = pool[0];
  for (const p of pool) {
    if (p.rating > best.rating || (p.rating === best.rating && p.price < best.price)) {
      best = p;
    }
  }

  const reasons: string[] = [];
  const bestSizeInfo = sizeInfoBySku[best.id];
  if (bestSizeInfo?.recommendation && bestSizeInfo.status !== "unavailable" && bestSizeInfo.status !== "loading") {
    const label = bestSizeInfo.status === "low" ? "only a few left" : "in stock";
    reasons.push(`your size ${bestSizeInfo.recommendation.size} is ${label}`);
  }
  reasons.push(`rated ${best.rating.toFixed(1)}★ from ${best.ratingCount.toLocaleString("en-IN")}+ reviews`);

  const pricier = products
    .filter((p) => p.id !== best.id && p.price > best.price)
    .sort((a, b) => b.price - a.price)[0];
  if (pricier) {
    reasons.push(`₹${(pricier.price - best.price).toLocaleString("en-IN")} cheaper than the ${pricier.brand}`);
  }

  return { productId: best.id, reasons };
}
