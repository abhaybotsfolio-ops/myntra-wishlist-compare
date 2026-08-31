import type { Product } from "../../data/schema.ts";
import type { AvailabilityStatus, SizeRecommendation } from "./size";

/**
 * D11 — five possible per-card labels (operator-directed, replacing the
 * two-label lowest-price/best-rated set). "BEST VALUE" is the same named
 * example RULES B3 lists as prohibited ("No automated winner. No 'Best
 * value'..."); the operator explicitly asked for it by name after already
 * overriding this exact rule once for the Pick-for-you card (D8) — treated
 * as an extension of that same override, not a new one. See DECISIONS.md D11.
 */
export type LeaderLabel = "BEST VALUE" | "BEST RATED" | "BEST FIT FOR YOU" | "LOWEST PRICE" | "FASTEST DELIVERY";

export interface DeckStats {
  priceMin: number;
  priceMax: number;
  ratingMin: number;
  ratingMax: number;
  /** null => no deck item has a size signal at all; the segment is
   * suppressed rather than showing a nonsensical "0 of 0" (RULES C3 —
   * never fabricate a size opinion, applied here one level up to an
   * aggregate rather than a single card). */
  inSizeCount: number | null;
  inSizeTotal: number;
  inSizeLoading: boolean;
  /** Every label this card genuinely qualifies for, priority-ordered and
   * already capped at 2 (operator: "assign 1-2 meaningful labels ... much
   * easier to understand than a dense matrix" — D11). */
  labelsBySku: Record<string, LeaderLabel[]>;
}

interface SizeInfoLike {
  recommendation: SizeRecommendation | null;
  status: AvailabilityStatus | "loading";
}

/**
 * A label renders on every card tied at the extreme, EXCEPT when the
 * entire deck shares that exact value — in that degenerate case a chip on
 * every single card asserts nothing (it's true but uninformative) and
 * starts to resemble a highlighted-card verdict even though each instance
 * is individually factual. A chip on some-but-not-all cards is genuinely
 * informative and stays inside RULES B3's "neutral factual marker" carve-out.
 */
function leaderFlags(
  products: Product[],
  getValue: (p: Product) => number,
  extreme: "min" | "max",
): Record<string, boolean> {
  const values = products.map(getValue);
  const target = extreme === "min" ? Math.min(...values) : Math.max(...values);
  const allTied = values.every((v) => v === target);
  const flags: Record<string, boolean> = {};
  for (const p of products) flags[p.id] = !allTied && getValue(p) === target;
  return flags;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Delivery by Tue, Sep 2" -> a small monotonic-within-a-year integer for
 * comparison. Parses the formatted string rather than needing a raw date
 * field on Product — the seed window never spans more than a week, so no
 * year-wrap risk, and this avoids hardcoding an anchor year into comparison
 * logic that would go stale. */
function deliveryRank(estimate: string): number {
  const m = estimate.match(/([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return Infinity;
  const monthIdx = MONTHS.indexOf(m[1]);
  const day = parseInt(m[2], 10);
  if (monthIdx === -1 || Number.isNaN(day)) return Infinity;
  return monthIdx * 31 + day;
}

// Priority order for the "1-2 labels per card" cap — the operator's own
// listed order (D11). A card can genuinely qualify for more than 2; only
// the top 2 by this priority are shown, so the row stays scannable.
const LABEL_PRIORITY: LeaderLabel[] = [
  "BEST VALUE",
  "BEST RATED",
  "BEST FIT FOR YOU",
  "LOWEST PRICE",
  "FASTEST DELIVERY",
];
const MAX_LABELS_PER_CARD = 2;

/**
 * Pure, deck-wide derivation — computed once per (products, sizeInfoBySku)
 * change at the compare page level (mirrors src/lib/size.ts's pure
 * getRecommendedSize/getStatus). labelsBySku feeds the carousel's leader
 * chips (D8, extended D11), the rest feeds AtAGlanceTable's Price/Rating rows.
 */
export function computeDeckStats(
  products: Product[],
  sizeInfoBySku: Record<string, SizeInfoLike>,
): DeckStats {
  const prices = products.map((p) => p.price);
  const ratings = products.map((p) => p.rating);

  const lowestPrice = leaderFlags(products, (p) => p.price, "min");
  const highestRated = leaderFlags(products, (p) => p.rating, "max");
  // rating per rupee — higher is better value. Divides by price (never 0
  // in the seed catalog) so this is a real computed ratio, not a guess.
  const bestValue = leaderFlags(products, (p) => p.rating / p.price, "max");
  const fastestDelivery = leaderFlags(products, (p) => deliveryRank(p.deliveryEstimate), "min");

  // "Best fit for you" reuses the real size signal (never a fabricated fit
  // preference — there is no such field in the data model): true only for
  // items that ARE available in the shopper's AI-recommended size, and
  // only when that's not universally true across the deck (same
  // some-but-not-all suppression as every other label here).
  const inSize: Record<string, boolean> = {};
  for (const p of products) {
    const info = sizeInfoBySku[p.id];
    inSize[p.id] = info?.recommendation != null && (info.status === "available" || info.status === "low");
  }
  const anyInSize = products.some((p) => inSize[p.id]);
  const allInSize = products.every((p) => inSize[p.id]);
  const bestFitForYou: Record<string, boolean> = {};
  for (const p of products) bestFitForYou[p.id] = anyInSize && !allInSize && inSize[p.id];

  const labelsBySku: Record<string, LeaderLabel[]> = {};
  for (const p of products) {
    const qualifies: Record<LeaderLabel, boolean> = {
      "BEST VALUE": bestValue[p.id] ?? false,
      "BEST RATED": highestRated[p.id] ?? false,
      "BEST FIT FOR YOU": bestFitForYou[p.id] ?? false,
      "LOWEST PRICE": lowestPrice[p.id] ?? false,
      "FASTEST DELIVERY": fastestDelivery[p.id] ?? false,
    };
    labelsBySku[p.id] = LABEL_PRIORITY.filter((label) => qualifies[label]).slice(0, MAX_LABELS_PER_CARD);
  }

  const signalled = products.filter((p) => sizeInfoBySku[p.id]?.recommendation != null);
  const inSizeLoading = signalled.some((p) => sizeInfoBySku[p.id]?.status === "loading");
  const inSizeCount =
    signalled.length === 0
      ? null
      : signalled.filter((p) => {
          const status = sizeInfoBySku[p.id]?.status;
          return status === "available" || status === "low";
        }).length;

  return {
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    ratingMin: Math.min(...ratings),
    ratingMax: Math.max(...ratings),
    inSizeCount,
    inSizeTotal: signalled.length,
    inSizeLoading,
    labelsBySku,
  };
}
