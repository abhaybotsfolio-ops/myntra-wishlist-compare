# DATA_MODEL.md

All seed data lives in `/data`, is validated by Zod schemas in `/data/schema.ts`, and is the
single source of truth for TypeScript types (`z.infer`). Do not hand-write duplicate
interfaces.

## Product

```ts
const Product = z.object({
  id:            z.string(),                      // "shirt-roadster-001"
  category:      z.enum(['shirts', 'pants']),     // RULES B1 — no other values exist
  brand:         z.string(),                      // "Roadster"
  title:         z.string(),                      // "Slim Fit Cotton Casual Shirt"
  images:        z.array(z.string()).min(1),      // "/products/shirt-roadster-001-1.jpg"
  mrp:           z.number().int(),                // 1799
  price:         z.number().int(),                // 899
  discountPct:   z.number().int(),                // 50 — derive, but store for display parity
  rating:        z.number().min(0).max(5),        // 4.1
  ratingCount:   z.number().int(),                // 2841
  fit:           z.string(),                      // "Slim Fit"
  material:      z.string(),                      // "100% Cotton"
  sizes:         z.array(z.string()),             // shirts: S–XXL, pants: 28–38
  savedAt:       z.string(),                      // ISO — wishlist ordering
});
```

Seed **16 products**: 9 shirts, 7 pants. Enough that a 4-item comparison feels selective and
the category filter does visible work. Price spread must be wide enough that price comparison
is meaningful — roughly ₹499 to ₹3,499. Ratings between 3.4 and 4.6; a product deck where
everything is 4.3 makes the rating row useless.

## Review

```ts
const Review = z.object({
  id:       z.string(),
  sku:      z.string(),
  rating:   z.number().int().min(1).max(5),
  text:     z.string(),        // synthetic — RULES A5
  size:     z.string().optional(),
  verified: z.boolean(),
  date:     z.string(),
});
```

Review volume per SKU, deliberately shaped so every branch of R5 is demoable:

| Band | SKUs | Review count | Renders |
|---|---|---|---|
| Rich, mostly positive | 6 | 30–60 | 2–3 themes, at least one mixed |
| Rich, genuinely mixed | 5 | 25–50, ≥30% at 1–3 stars | must include a negative theme (RULES C2) |
| Thin | 3 | 8–14 | summarised, but noticeably shorter corpus |
| Below threshold | 2 | 2–5 | **"Not enough reviews yet"**, no LLM call |

Reviews must name concrete, comparable specifics — fabric feel after washes, sleeve length,
colour vs. photo, waist running small — because a summary of vague reviews is a vague summary,
and R5 exists to resolve quality and fit doubt.

## Inventory

```ts
const Inventory = z.record(
  z.string(),                                  // sku
  z.record(z.string(), z.number().int())       // size → units
);
```

Served from `/api/inventory`, never embedded in the product record — see ARCHITECTURE §5.
Seed so that across the 16 SKUs: most sizes in stock, a handful at 1–2 units ("Only 2 left"),
and **at least two SKUs out of stock in the user's recommended size from the start**, so the
unavailable branch of R4 is reachable without waiting for the scripted event.

## Size profile

```ts
const SizeSignal = z.object({
  brand:      z.string(),
  size:       z.string(),
  confidence: z.enum(['high', 'medium']),
  source:     z.enum(['past_purchase', 'past_return', 'stated_preference']),
  basis:      z.string(),   // "You bought M in Roadster twice" — shown in the wedge
});

const SizeProfile = z.object({
  defaultShirtSize: z.string(),
  defaultPantSize:  z.string(),
  signals:          z.array(SizeSignal),
});
```

`basis` is what makes the wedge trustworthy rather than magical — the user can see *why* the
app thinks they're an M in that brand. **Leave at least two brands out of `signals`
entirely.** Those SKUs must render the general size guide, per R4 and RULES C3. Resist the
temptation to fall back to `defaultShirtSize` and call it a recommendation — that is exactly
the "guess presented as a recommendation" the PRD forbids.

## Stock events (scripted)

```ts
const StockEvent = z.object({
  atMs:      z.number().int(),   // ms after comparison_started
  sku:       z.string(),
  size:      z.string(),
  newUnits:  z.number().int(),   // 0
  condition: z.literal('sku_in_active_deck'),
});
```

Deterministic, not random — a demo that only sometimes shows the live-update behaviour is a
demo that fails in front of the reviewer. Seed one event at 15000ms and one at 40000ms so a
longer session sees a second.

## Summary (returned by `/api/summarize`, and the shape of the fallback file)

```ts
const Theme = z.object({
  label:     z.string().max(28),                        // "Fabric softens after wash"
  detail:    z.string().max(110),                       // one supporting sentence
  sentiment: z.enum(['positive', 'mixed', 'negative']),
  mentions:  z.number().int(),                          // how many reviews touched it
});

const Summary = z.object({
  sku:      z.string(),
  status:   z.enum(['ok', 'insufficient_reviews']),
  themes:   z.array(Theme).min(2).max(3),               // empty when insufficient
  source:   z.enum(['llm', 'fallback']),                // never rendered; for the event log
  basedOn:  z.number().int(),                           // review count, shown as "from 34 reviews"
});
```

`summaries.fallback.json` holds a hand-written `Summary` for every SKU above threshold. It is
the reliability floor from RULES D1 and D3 — the app must be fully demoable with no API key
at all. Write these fallbacks *before* wiring the LLM, not after; if you build the fallback
last you will build it carelessly.

`mentions` and `basedOn` are what stop the summary reading like marketing copy. "Runs small
in the waist — 11 of 34 reviews" is evidence. "Great fit!" is not.
