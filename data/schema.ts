import { z } from "zod";

/**
 * Single source of truth for every seed data shape and its TypeScript type
 * (`z.infer`). Do not hand-write duplicate interfaces elsewhere — import the
 * types from here. Mirrors docs/DATA_MODEL.md exactly; that doc is the
 * spec, this file is the enforcement.
 */

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export const ProductSchema = z.object({
  id: z.string(), // "shirt-roadster-001"
  category: z.enum(["shirts", "pants"]), // RULES B1 — no other values exist
  brand: z.string(),
  title: z.string(),
  images: z.array(z.string()).min(1),
  mrp: z.number().int(),
  price: z.number().int(),
  discountPct: z.number().int(),
  rating: z.number().min(0).max(5),
  ratingCount: z.number().int(),
  fit: z.string(),
  material: z.string(),
  sizes: z.array(z.string()),
  savedAt: z.string(), // ISO — wishlist ordering
});
export type Product = z.infer<typeof ProductSchema>;
export const ProductsFileSchema = z.array(ProductSchema);

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export const ReviewSchema = z.object({
  id: z.string(),
  sku: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(), // synthetic — RULES A5
  size: z.string().optional(),
  verified: z.boolean(),
  date: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;
export const ReviewsFileSchema = z.array(ReviewSchema);

// ---------------------------------------------------------------------------
// Inventory — sku -> size -> units. Never embedded in the product record.
// ---------------------------------------------------------------------------

export const InventorySchema = z.record(
  z.string(),
  z.record(z.string(), z.number().int()),
);
export type Inventory = z.infer<typeof InventorySchema>;

// ---------------------------------------------------------------------------
// Size profile
// ---------------------------------------------------------------------------

export const SizeSignalSchema = z.object({
  brand: z.string(),
  size: z.string(),
  confidence: z.enum(["high", "medium"]),
  source: z.enum(["past_purchase", "past_return", "stated_preference"]),
  basis: z.string(), // "You bought M in Roadster twice" — shown in the wedge
});
export type SizeSignal = z.infer<typeof SizeSignalSchema>;

export const SizeProfileSchema = z.object({
  defaultShirtSize: z.string(),
  defaultPantSize: z.string(),
  signals: z.array(SizeSignalSchema),
});
export type SizeProfile = z.infer<typeof SizeProfileSchema>;

// ---------------------------------------------------------------------------
// Stock events (scripted, deterministic)
// ---------------------------------------------------------------------------

export const StockEventSchema = z.object({
  atMs: z.number().int(), // ms after comparison_started
  sku: z.string(),
  size: z.string(),
  newUnits: z.number().int(), // 0
  condition: z.literal("sku_in_active_deck"),
});
export type StockEvent = z.infer<typeof StockEventSchema>;
export const StockEventsFileSchema = z.array(StockEventSchema);

// ---------------------------------------------------------------------------
// Summary — returned by /api/summarize, and the shape of the fallback file
// ---------------------------------------------------------------------------

export const ThemeSchema = z.object({
  label: z.string().max(28), // "Fabric softens after wash"
  detail: z.string().max(110), // one supporting sentence
  sentiment: z.enum(["positive", "mixed", "negative"]),
  mentions: z.number().int(), // how many reviews touched it
});
export type Theme = z.infer<typeof ThemeSchema>;

// DATA_MODEL.md writes `themes: z.array(Theme).min(2).max(3)` but its own
// worked example for the below-threshold case returns `themes: []` — a flat
// min(2) would reject that. The real invariant is conditional on `status`,
// so it's enforced with superRefine instead of loosened away. See DECISIONS.md.
export const SummarySchema = z
  .object({
    sku: z.string(),
    status: z.enum(["ok", "insufficient_reviews"]),
    themes: z.array(ThemeSchema).max(3),
    source: z.enum(["llm", "fallback"]), // never rendered; for the event log
    basedOn: z.number().int(), // review count, shown as "from 34 reviews"
  })
  .superRefine((summary, ctx) => {
    if (summary.status === "ok" && summary.themes.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["themes"],
        message: "status 'ok' requires 2-3 themes",
      });
    }
    if (summary.status === "insufficient_reviews" && summary.themes.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["themes"],
        message: "status 'insufficient_reviews' must carry no themes",
      });
    }
  });
export type Summary = z.infer<typeof SummarySchema>;
export const SummariesFallbackFileSchema = z.record(z.string(), SummarySchema);
