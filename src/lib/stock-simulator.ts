import { PRODUCTS, INVENTORY, SIZE_PROFILE, STOCK_EVENTS } from "./catalog";
import { getRecommendedSize, getStatus } from "./size";

export interface ResolvedStockEvent {
  atMs: number;
  sku: string;
  size: string;
}

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

/**
 * size-wedge skill: "At comparison_started, resolve the event against the
 * actual deck — pick a SKU the user selected that is currently available
 * in their recommended size." data/stock-events.json's own sku/size are
 * illustrative, not literal targets — a deck that doesn't happen to
 * include shirt-hereandnow-002 would otherwise never see the scripted
 * event at all, which is exactly the "demo behaviour that will not fire in
 * front of the reviewer" the skill warns against. Only the *timing*
 * (atMs) from the seed file is used; the target is picked fresh from
 * whatever's actually in the deck. Deterministic (first eligible
 * candidate per slot, cycling if there are fewer candidates than slots),
 * not random. See DECISIONS.md D4.
 */
export function resolveStockEvents(deckSkus: string[]): ResolvedStockEvent[] {
  const candidates: { sku: string; size: string }[] = [];
  for (const sku of deckSkus) {
    const product = PRODUCTS_BY_ID.get(sku);
    if (!product) continue;
    const rec = getRecommendedSize(SIZE_PROFILE, product.brand);
    if (!rec) continue; // no-signal branch has nothing to drop
    if (getStatus(INVENTORY, sku, rec.size) !== "available") continue; // already low/unavailable — no visible drop to show
    candidates.push({ sku, size: rec.size });
  }
  if (candidates.length === 0) return [];

  const timings = [...new Set(STOCK_EVENTS.map((e) => e.atMs))].sort((a, b) => a - b);
  return timings.map((atMs, i) => ({ atMs, ...candidates[i % candidates.length] }));
}

/** Applies any resolved events whose atMs has elapsed to a copy of the base
 * inventory. Pure/stateless — safe to call on every request (no server
 * memory needed): elapsed time is derived from the client-supplied
 * `deckStartedAt`, not from anything the server remembers between calls. */
export function applyStockEvents(
  baseInventory: typeof INVENTORY,
  deckSkus: string[],
  deckStartedAt: number | null,
): typeof INVENTORY {
  if (deckStartedAt === null) return baseInventory;
  const elapsedMs = Date.now() - deckStartedAt;
  const resolved = resolveStockEvents(deckSkus);
  const due = resolved.filter((e) => elapsedMs >= e.atMs);
  if (due.length === 0) return baseInventory;

  const next: typeof INVENTORY = structuredClone(baseInventory);
  for (const e of due) {
    if (!next[e.sku]) next[e.sku] = {};
    next[e.sku][e.size] = 0;
  }
  return next;
}
