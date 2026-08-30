/**
 * Data-access layer over the seed JSON. Every mock here sits behind a
 * function signature a real service could satisfy unchanged — see
 * docs/ARCHITECTURE.md §9. Safe to import from server or client code (no
 * node:fs — static JSON imports work in every Next.js runtime).
 *
 * RULES F4: Zod-validated at load, fails loudly in development, falls back
 * to a known-good subset in production rather than crashing.
 */
import { z } from "zod";
import {
  ProductsFileSchema,
  ReviewsFileSchema,
  InventorySchema,
  SizeProfileSchema,
  StockEventsFileSchema,
  SummariesFallbackFileSchema,
  type Product,
  type Review,
  type Inventory,
  type SizeProfile,
  type StockEvent,
  type Summary,
} from "../../data/schema.ts";
import { isFullyOutOfStock } from "./size";

import productsRaw from "../../data/products.json";
import reviewsRaw from "../../data/reviews.json";
import inventoryRaw from "../../data/inventory.json";
import sizeProfileRaw from "../../data/size-profile.json";
import stockEventsRaw from "../../data/stock-events.json";
import summariesRaw from "../../data/summaries.fallback.json";

function loadOrFallback<T>(name: string, raw: unknown, schema: z.ZodType<T>, fallback: T): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const message = `[catalog] data/${name} failed Zod validation: ${JSON.stringify(result.error.issues).slice(0, 500)}`;
  if (process.env.NODE_ENV === "development") {
    // fail loudly in development — a malformed seed file should never be
    // silently papered over while building
    throw new Error(message);
  }
  console.error(message);
  return fallback;
}

export const PRODUCTS: Product[] = loadOrFallback("products.json", productsRaw, ProductsFileSchema, []);
export const REVIEWS: Review[] = loadOrFallback("reviews.json", reviewsRaw, ReviewsFileSchema, []);
export const INVENTORY: Inventory = loadOrFallback("inventory.json", inventoryRaw, InventorySchema, {});
export const SIZE_PROFILE: SizeProfile = loadOrFallback(
  "size-profile.json",
  sizeProfileRaw,
  SizeProfileSchema,
  { defaultShirtSize: "M", defaultPantSize: "32", signals: [] },
);
export const STOCK_EVENTS: StockEvent[] = loadOrFallback("stock-events.json", stockEventsRaw, StockEventsFileSchema, []);
export const FALLBACK_SUMMARIES: Record<string, Summary> = loadOrFallback(
  "summaries.fallback.json",
  summariesRaw,
  SummariesFallbackFileSchema,
  {},
);

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

/** Computed once at module scope from the same static seed data every other
 * export here reads — the wishlist's "Out of Stock" filter and tile dimming
 * both key off this set rather than re-deriving it per component. */
export const OUT_OF_STOCK_PRODUCT_IDS: Set<string> = new Set(
  PRODUCTS.filter((p) => isFullyOutOfStock(p.sizes, INVENTORY[p.id])).map((p) => p.id),
);

export function getProducts(category?: "shirts" | "pants"): Product[] {
  return category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
}
export function getProduct(id: string): Product | undefined {
  return PRODUCTS_BY_ID.get(id);
}
export function getReviews(sku: string): Review[] {
  return REVIEWS.filter((r) => r.sku === sku);
}
export function getReviewCount(sku: string): number {
  let n = 0;
  for (const r of REVIEWS) if (r.sku === sku) n++;
  return n;
}
export function getFallbackSummary(sku: string): Summary | undefined {
  return FALLBACK_SUMMARIES[sku];
}
