# ARCHITECTURE.md

Solution architecture for the Myntra Wishlist Comparison MVP. Read before writing code.

---

## 1. Shape of the system

This is a **single Next.js 15 application deployed to Vercel**. There is no separate backend,
no database, and no external service other than one LLM provider. Everything the app needs to
render is either in the client bundle or in a seed JSON file read by a Route Handler.

That is a deliberate constraint. The PRD describes a feature that in production would sit on
top of Myntra's catalog service, inventory service, size-intelligence service and review
store. This MVP replaces each of those with a seeded module behind an interface that has the
same *shape* as the real thing would. That way the demo is honest about what is mocked, and
the reviewer can see where the real integration points are.

```
                        ┌──────────────────────────────────────────┐
                        │            Browser (390×844)             │
                        │                                          │
   /wishlist ──────────▶│  WishlistScreen                          │
                        │    ├─ CategoryTabs      (R1)             │
                        │    ├─ CompareCTA        (R1)             │
                        │    ├─ SelectionOverlay  (R2)             │
                        │    └─ StickyCompareBar  (R2)             │
                        │                                          │
   /compare ───────────▶│  CompareDeck            (R3)             │
                        │    ├─ CompareCard × n                    │
                        │    │    ├─ AttributeRows (fixed order)   │
                        │    │    ├─ SizeWedge     (R4)  ◀──┐      │
                        │    │    ├─ ReviewSummary (R5)  ◀──┼──┐   │
                        │    │    └─ CardActions   (R6)     │  │   │
                        │    └─ PositionIndicator (R3)      │  │   │
                        │                                   │  │   │
   /product/[id] ──────▶│  ProductScreen (PDP-lite) (R6)    │  │   │
                        │                                   │  │   │
                        │  Zustand store (sessionStorage)   │  │   │
                        │    wishlist · selection · deck ·  │  │   │
                        │    bag · sizeProfile · events     │  │   │
                        └───────────────────┬───────────────┼──┼───┘
                                            │               │  │
                        ┌───────────────────▼───────────────┼──┼───┐
                        │      Next.js Route Handlers       │  │   │
                        │                                   │  │   │
                        │  GET  /api/catalog                │  │   │
                        │  GET  /api/inventory?skus=…  ─────┘  │   │
                        │       (polled every 8s, R4)          │   │
                        │  POST /api/summarize          ───────┘   │
                        │       → Gemini, 6s timeout, cached         │
                        └───────────────────┬──────────────────────┘
                                            │
                        ┌───────────────────▼──────────────────────┐
                        │  Seed layer (/data, Zod-validated)       │
                        │   products.json · reviews.json           │
                        │   inventory.json · size-profile.json     │
                        │   summaries.fallback.json                │
                        └──────────────────────────────────────────┘
```

## 2. Why the LLM sits on the server

The Gemini key must never reach the browser, so summarisation is a Route Handler. Two further
consequences worth designing around:

- **Caching is server-side and free.** A module-scope `Map<sku, Summary>` survives across
  requests in a warm Vercel lambda. Cache on `sku + reviewCount`. Users swiping back and
  forth across a 4-card deck must not trigger 4 LLM calls per swipe.
- **Summaries are prefetched, not lazy.** The moment the user confirms their selection, fire
  one POST for all 2–4 SKUs in parallel while the deck-entry animation plays. By the time
  card 1 is interactive, the summaries are usually in. Cards render a skeleton in that row,
  never a spinner that shifts layout — see RULES §E2.

## 3. Route map

| Route | Type | Purpose |
|---|---|---|
| `/` | page | Redirects to `/wishlist` |
| `/wishlist` | page | R1, R2. Category tabs, grid, selection mode |
| `/compare` | page | R3–R6. Reads the deck from the store; redirects to `/wishlist` if the set has fewer than 2 items |
| `/product/[id]` | page | R6 "See product". A deliberately thin PDP — enough to feel real, with a back affordance that returns to the exact card index |
| `/api/catalog` | GET | Products + reviews metadata. Zod-validated |
| `/api/inventory` | GET | Per-SKU per-size stock. Polled; drives R4's live update |
| `/api/summarize` | POST | `{skus: string[]}` → themes per SKU. Gemini-backed with fallback |

## 4. State model (Zustand + `persist` on sessionStorage)

```ts
interface AppState {
  wishlist:      string[];                    // sku ids, ordered by save date
  activeCategory:'all' | 'shirts' | 'pants';
  mode:          'browse' | 'selecting';      // R1
  selection:     string[];                    // R2, max 4
  deck:          string[];                    // R3, frozen at confirm
  deckIndex:     number;                      // R3, position indicator
  bag:           string[];                    // R6
  sizeProfile:   Record<Brand, SizeSignal>;   // R4
  events:        AnalyticsEvent[];            // ring buffer, cap 200
}
```

`persist` on sessionStorage is what satisfies R3's "persists if the user backgrounds the app
and returns within the same session". Session, not local — a new tab is a new session, which
matches the PRD's wording. Do not use localStorage: it would make the comparison set outlive
the session and contradict the spec.

**Derived, never stored:** the filtered wishlist for the active category, whether the Compare
CTA is enabled, whether the sticky bar is enabled, deck length. Storing these creates the
class of bug where removing an item leaves a stale count in the indicator (R6).

## 5. The size wedge (R4) — the load-bearing piece

Three separate concerns, deliberately kept apart:

1. **Recommendation.** `getRecommendedSize(profile, brand) → {size, confidence, source} | null`.
   Returns `null` when there is no brand signal. The card branches on `null` and renders the
   general size guide (RULES §C3). At least one brand in the seed data must have no signal so
   this path is visible in the demo.
2. **Availability.** `getStatus(sku, size) → 'available' | 'low' | 'unavailable'`. Sourced from
   `/api/inventory`, never from the product record. Keeping inventory in its own endpoint is
   what makes the live-update criterion implementable at all.
3. **Live update.** A polling hook (`useInventory`, 8s interval, only while `/compare` is
   mounted and the tab is visible) plus a **scripted stock event**: ~15 seconds into a
   comparison session, one SKU in the current deck goes out of stock in the user's
   recommended size. The card's wedge transitions in place and a non-blocking toast explains
   it. This is the only way a reviewer will ever *see* the fourth acceptance criterion of R4
   in a two-minute demo. Implement it as a seeded, deterministic simulator in
   `/data/stock-events.json`, not as randomness.

Availability changes badge state and disables Add to Bag with a stated reason. It never
removes, reorders, or hides a card — RULES §B4.

## 6. Attribute row alignment (R3) — how to actually guarantee it

Do not lay each card out independently and hope. Define one config:

```ts
export const ATTRIBUTE_ROWS = [
  { key: 'image',    minH: 200 },
  { key: 'identity', minH: 56  },  // brand + title
  { key: 'price',    minH: 52  },
  { key: 'rating',   minH: 36  },
  { key: 'size',     minH: 76  },  // the wedge — between price and reviews, per PRD §8
  { key: 'fit',      minH: 40  },
  { key: 'material', minH: 40  },
  { key: 'reviews',  minH: 132 },
  { key: 'actions',  minH: 96  },  // pinned, always visible without scrolling
] as const;
```

Every card maps over this array in order. A missing value renders an em-dash inside a row of
the same height. Because `minH` is shared, the price row on card 3 is at the same y-offset as
on card 1, which is the entire point of the mechanic. Add a dev-only overlay (toggled by
pressing `g`) that draws horizontal guides at each row boundary, so alignment regressions are
visible rather than subtle.

## 7. Analytics events (fixed names)

Emitted via a single `track()` into an in-memory ring buffer and `console.debug`. No SDK.
These names map one-to-one onto the PRD §7 metrics; a reviewer may ask how you would measure
the feature, and this is the answer.

| Event | Payload | Metric it feeds |
|---|---|---|
| `wishlist_viewed` | `{category, itemCount}` | Denominator for initiation rate |
| `compare_tapped` | `{category, eligibleCount}` | Comparison initiation rate |
| `selection_changed` | `{count, sku, action}` | Selection funnel |
| `selection_limit_hit` | `{attemptedSku}` | R2 friction |
| `comparison_started` | `{skus, count}` | Comparison completion numerator |
| `card_swiped` | `{fromIndex, toIndex, method}` | Completion (2+ items and ≥1 swipe) |
| `size_wedge_viewed` | `{sku, status, hasSignal}` | Size wedge exposure |
| `size_wedge_tapped` | `{sku, status}` | Size wedge click-through |
| `stock_changed_in_session` | `{sku, size, from, to}` | R4 live-update instrumentation |
| `summary_rendered` | `{sku, source, themeCount, hasNegative}` | R5 quality |
| `add_to_bag` | `{sku, fromSurface, dwellMs}` | Compare → ATB conversion |
| `remove_from_wishlist` | `{sku, fromSurface, remaining}` | R6 |
| `pdp_opened` | `{sku, fromSurface}` | Leakage proxy |
| `comparison_exited` | `{reason, durationMs, swipes, decided}` | Decision-efficiency + leakage |

`durationMs` and `dwellMs` are what make the decision-efficiency proxy computable. Capture
them even though nothing in this MVP displays them.

## 8. Repository layout

```
myntra-wishlist-compare/
├── CLAUDE.md                 · build brief (this bundle)
├── RULES.md                  · hard constraints
├── README.md                 · written by you at the end
├── DECISIONS.md              · written by you as you go
├── .env.example
├── .claude/skills/…          · the five skills
├── docs/                     · PRD, ARCHITECTURE, DATA_MODEL, BUILD_PLAN, ACCEPTANCE
├── data/
│   ├── products.json
│   ├── reviews.json
│   ├── inventory.json
│   ├── size-profile.json
│   ├── stock-events.json
│   ├── summaries.fallback.json
│   └── schema.ts             · Zod schemas, single source of truth for types
├── public/products/          · committed imagery + CREDITS.md
├── src/
│   ├── app/
│   │   ├── layout.tsx        · phone frame wrapper for desktop
│   │   ├── wishlist/page.tsx
│   │   ├── compare/page.tsx
│   │   ├── product/[id]/page.tsx
│   │   └── api/{catalog,inventory,summarize}/route.ts
│   ├── components/
│   │   ├── wishlist/         · CategoryTabs, ProductTile, SelectionOverlay, StickyCompareBar
│   │   ├── compare/          · CompareDeck, CompareCard, AttributeRow, PositionIndicator,
│   │   │                       SizeWedge, ReviewSummary, CardActions
│   │   └── ui/               · Button, Badge, Toast, Sheet, Skeleton, PhoneFrame
│   ├── lib/
│   │   ├── store.ts          · Zustand
│   │   ├── size.ts           · recommendation + availability logic
│   │   ├── summarize.ts      · prompt, parsing, validation, fallback
│   │   ├── track.ts          · analytics
│   │   └── constants.ts      · ATTRIBUTE_ROWS, thresholds, tokens
│   └── types/
└── tests/e2e/                · Playwright, one spec per requirement
```

## 9. Integration points a reviewer will ask about

Document these in `README.md`. Each mock sits behind a function signature that a real service
could satisfy unchanged:

| MVP mock | Production equivalent |
|---|---|
| `data/products.json` | Catalog service / PDP API |
| `/api/inventory` polling | Inventory service, ideally a websocket or SSE subscription |
| `data/size-profile.json` | Myntra size/fit intelligence service (PRD R4 names it explicitly) |
| `/api/summarize` over synthetic reviews | Same route, pointed at the real review store, with summaries precomputed nightly per SKU rather than on demand |
| Zustand `wishlist` array | Wishlist service |

The PRD's §9 open question — whether the size service can answer fast enough not to slow the
swipe — is worth answering in the README with the measured p95 of your own recommendation
call, and a note that the real constraint is the network hop this MVP does not have.
