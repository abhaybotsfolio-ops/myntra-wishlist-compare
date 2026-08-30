/**
 * Fixed, shared constants. Nothing here is per-component config — every value
 * is referenced from at least two places, which is exactly why it lives here
 * instead of being redeclared. See docs/ARCHITECTURE.md §6 and DATA_MODEL.md.
 */

/** Fixed attribute row order for every compare card. RULES.md E1/E2, ARCHITECTURE.md §6.
 * The size wedge sits between price and reviews — that position is PRD §8's whole point. */
export const ATTRIBUTE_ROWS = [
  { key: "image", minH: 200 },
  { key: "identity", minH: 56 }, // brand + title
  { key: "price", minH: 56 }, // +4px over the bare price line — headroom for a leader chip
  { key: "rating", minH: 40 }, // +4px over the bare rating pill — same reason
  { key: "size", minH: 76 }, // the wedge
  { key: "fit", minH: 40 },
  { key: "material", minH: 40 },
  { key: "reviews", minH: 132 },
  { key: "actions", minH: 96 }, // pinned, always visible without scrolling
] as const;

export type AttributeRowKey = (typeof ATTRIBUTE_ROWS)[number]["key"];

/** RULES.md C1, DATA_MODEL.md — below this review count, no LLM call, honest empty state. */
export const REVIEW_THRESHOLD = 8;

/** PRD R2 — comparison set is capped at 4 and floored at 2 (RULES B5). */
export const SELECTION_MIN = 2;
export const SELECTION_MAX = 4;

/** ARCHITECTURE.md §5 — inventory polling cadence while /compare is mounted and visible. */
export const INVENTORY_POLL_MS = 8000;

/** DATA_MODEL.md — units at or below this render "low stock", not "available". */
export const LOW_STOCK_MAX_UNITS = 2;

/** review-summarizer skill — per-SKU Gemini call timeout before falling back. */
export const SUMMARY_TIMEOUT_MS = 6000;

/** Categories that exist anywhere in the UI. RULES B1 — nothing else, ever. */
export const CATEGORIES = ["shirts", "pants"] as const;
export type Category = (typeof CATEGORIES)[number];
