import type { Inventory, SizeProfile } from "../../data/schema.ts";
import { LOW_STOCK_MAX_UNITS } from "./constants";

export type SizeRecommendation = {
  size: string;
  confidence: "high" | "medium";
  basis: string;
};

export type AvailabilityStatus = "available" | "low" | "unavailable";

/**
 * size-wedge skill, concern 1: looks up profile.signals by brand, returns
 * null with no signal. Never falls back to defaultShirtSize/defaultPantSize
 * and never infers from a sibling brand — those fields exist on
 * SizeProfile for a general-guide default elsewhere, not as a size
 * recommendation source. A confidently wrong size is worse than an honest
 * "we don't know" (RULES C3).
 */
export function getRecommendedSize(
  profile: SizeProfile,
  brand: string,
): SizeRecommendation | null {
  const signal = profile.signals.find((s) => s.brand === brand);
  if (!signal) return null;
  return { size: signal.size, confidence: signal.confidence, basis: signal.basis };
}

/**
 * size-wedge skill, concern 2: sourced from inventory (i.e. /api/inventory
 * at the call site), never from the product record — RULES B4/ARCHITECTURE
 * §5. Undefined (sku or size not stocked at all) reads as unavailable
 * rather than throwing; a missing row is not a reason to crash a compare
 * card.
 */
export function getStatus(
  inventory: Inventory,
  sku: string,
  size: string,
): AvailabilityStatus {
  const units = inventory[sku]?.[size];
  if (units === undefined || units <= 0) return "unavailable";
  if (units <= LOW_STOCK_MAX_UNITS) return "low";
  return "available";
}

/**
 * Wishlist tile / "Out of Stock" filter concern: a product reads as out of
 * stock when every size it's offered in has zero units — a factual,
 * inventory-backed check (RULES B2 — no urgency framing, no guessing),
 * distinct from the size-wedge's *recommended-size*-specific getStatus
 * above, which only ever looks at one size at a time.
 */
export function isFullyOutOfStock(
  sizes: string[],
  row: Record<string, number> | undefined,
): boolean {
  if (!row) return false; // no inventory row at all — not a claim of stock-out
  return sizes.every((size) => (row[size] ?? 0) <= 0);
}

/** myntra-ui/size-wedge skill: "a real chart with chest/waist
 * measurements, not a placeholder" for the no-signal branch. */
export const SIZE_GUIDE = {
  shirts: {
    unit: "in",
    columns: ["Size", "Chest", "Length", "Shoulder"],
    rows: [
      ["S", "36–38", "27.5", "17"],
      ["M", "38–40", "28.5", "17.75"],
      ["L", "40–42", "29.5", "18.5"],
      ["XL", "42–44", "30.5", "19.25"],
      ["XXL", "44–46", "31.5", "20"],
    ],
  },
  pants: {
    unit: "in",
    columns: ["Size", "Waist", "Hip", "Inseam"],
    rows: [
      ["28", "28–29", "37", "31"],
      ["30", "30–31", "39", "31.5"],
      ["32", "32–33", "41", "32"],
      ["34", "34–35", "43", "32.5"],
      ["36", "36–37", "45", "33"],
      ["38", "38–39", "47", "33.5"],
    ],
  },
} as const;
