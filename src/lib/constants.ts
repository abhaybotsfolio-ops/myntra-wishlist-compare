/**
 * Fixed, shared constants. Nothing here is per-component config — every value
 * is referenced from at least two places, which is exactly why it lives here
 * instead of being redeclared. See docs/ARCHITECTURE.md §6 and DATA_MODEL.md.
 */

/** RULES.md C1, DATA_MODEL.md — below this review count, no LLM call, honest empty state. */
export const REVIEW_THRESHOLD = 8;

/** PRD R2 — comparison set is capped at 4 and floored at 2 (RULES B5). */
export const SELECTION_MIN = 2;
export const SELECTION_MAX = 4;

/** ARCHITECTURE.md §5 — inventory polling cadence while /compare is mounted and visible. */
export const INVENTORY_POLL_MS = 8000;

/** DATA_MODEL.md — units at or below this render "low stock", not "available". */
export const LOW_STOCK_MAX_UNITS = 2;

/** review-summarizer skill — per-SKU Gemini call timeout before falling back.
 * Was 6000ms, tuned for gemini-2.0-flash. gemini-3.6-flash — the model that
 * replaced it after Google retired 2.0-flash — "thinks" (extended internal
 * reasoning) by default and, confirmed live, doesn't support disabling that
 * for this task (rejects thinkingConfig.thinkingBudget: 0 outright). Given
 * real headroom here instead, well under the API route's own
 * `maxDuration = 45` (seconds) so this code's own honest fallback can
 * always win over a raw platform kill. DECISIONS.md D10. */
export const SUMMARY_TIMEOUT_MS = 35000;

/** Categories that exist anywhere in the UI. RULES B1 — nothing else, ever. */
export const CATEGORIES = ["shirts", "pants"] as const;
export type Category = (typeof CATEGORIES)[number];
