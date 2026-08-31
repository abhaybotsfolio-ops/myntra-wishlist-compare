import type { Product } from "../../data/schema.ts";
import type { AvailabilityStatus, SizeRecommendation } from "./size";

export interface LeaderInfo {
  lowestPrice: boolean;
  highestRated: boolean;
}

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
  leaderBySku: Record<string, LeaderInfo>;
}

interface SizeInfoLike {
  recommendation: SizeRecommendation | null;
  status: AvailabilityStatus | "loading";
}

/**
 * A leader chip renders on every card tied at the extreme, EXCEPT when the
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

/**
 * Pure, deck-wide derivation — computed once per (products, sizeInfoBySku)
 * change at the compare page level (mirrors src/lib/size.ts's pure
 * getRecommendedSize/getStatus). leaderBySku feeds the carousel's leader
 * chips (D8), the rest feeds AtAGlanceTable's Price/Rating rows.
 */
export function computeDeckStats(
  products: Product[],
  sizeInfoBySku: Record<string, SizeInfoLike>,
): DeckStats {
  const prices = products.map((p) => p.price);
  const ratings = products.map((p) => p.rating);

  const lowestPrice = leaderFlags(products, (p) => p.price, "min");
  const highestRated = leaderFlags(products, (p) => p.rating, "max");

  const leaderBySku: Record<string, LeaderInfo> = {};
  for (const p of products) {
    leaderBySku[p.id] = {
      lowestPrice: lowestPrice[p.id] ?? false,
      highestRated: highestRated[p.id] ?? false,
    };
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
    leaderBySku,
  };
}
