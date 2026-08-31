# Myntra Wishlist Comparison — MVP

An interactive, mobile-first prototype of a **comparison mode inside a Myntra-style wishlist**.
A shopper filters their wishlist to Shirts or Pants, selects 2–4 saved items, and swipes
through a side-by-side card deck showing price, rating, fit, material, **size availability in
their size**, and an AI-generated summary of what other buyers said — then adds to bag, opens
the full product page, or removes the item, all without leaving the comparison.

Built from the spec bundle in this repo (`CLAUDE.md`, `RULES.md`, `docs/`, `.claude/skills/`)
following `docs/BUILD_PLAN.md`'s nine phases, with every acceptance row in `docs/ACCEPTANCE.md`
either automated in `tests/e2e/` or checked by hand.

**Live URL:** _added after deploy — see the final section of this README once that step runs._

## Run it locally

```bash
npm install
npm run validate:data   # optional — Zod-validates every seed file and its invariants
npm run dev
```

Open `http://localhost:3000` (redirects to `/wishlist`). No environment variables are required
— the app runs fully on precomputed data with zero keys set (see [What's mocked](#whats-mocked-vs-real) below).
To exercise live AI review summaries instead of the precomputed fallback, copy `.env.example`
to `.env.local` and set `GEMINI_API_KEY` (free key: https://aistudio.google.com/apikey).

## Requirement map

Every PRD requirement (`docs/PRD.md` §5), where it's implemented, and how it's verified.

| Req | What | Implementation | Verified by |
|---|---|---|---|
| **R1** — Entry point | Compare CTA on the wishlist, disabled with a reason off single-category or <2 items | [`CompareCTA.tsx`](src/components/wishlist/CompareCTA.tsx), [`wishlist/page.tsx`](src/app/wishlist/page.tsx) | `tests/e2e/r1-entry.spec.ts` (5/5 auto) |
| **R2** — 2–4 selection | Selection overlay on tiles, cap-at-4 with a toast, tabs locked while selecting, scroll preserved | [`ProductTile.tsx`](src/components/wishlist/ProductTile.tsx), [`StickyCompareBar.tsx`](src/components/wishlist/StickyCompareBar.tsx), [`lib/store.ts`](src/lib/store.ts) | `tests/e2e/r2-selection.spec.ts` (7/7 auto) |
| **R3** — Swipe deck | Compact swipeable carousel (framer-motion drag) plus a shared comparison table below it, dots + "N of M", session persistence — rebuilt to match an operator-supplied prototype, see [Beyond the PRD](#beyond-the-prd-wishlist-redesign--comparison-decision-support) | [`CompareCarousel.tsx`](src/components/compare/CompareCarousel.tsx), [`AtAGlanceTable.tsx`](src/components/compare/AtAGlanceTable.tsx), [`DetailsTable.tsx`](src/components/compare/DetailsTable.tsx) | `tests/e2e/r3-deck.spec.ts` (7/7 auto) |
| **R4** — Size wedge | Recommendation (brand lookup, never a guess), live inventory-backed availability, scripted stock-change event | [`lib/size.ts`](src/lib/size.ts), [`lib/stock-simulator.ts`](src/lib/stock-simulator.ts), [`SizeLine.tsx`](src/components/compare/SizeLine.tsx), [`useInventory.ts`](src/lib/useInventory.ts) | `tests/e2e/r4-size.spec.ts` (8/8 auto) |
| **R5** — Review summary | Gemini-backed themes, threshold gate, anti-sycophancy validator — shown for whichever card is centered in the carousel | [`lib/summarize.ts`](src/lib/summarize.ts), [`ReviewSummary.tsx`](src/components/compare/ReviewSummary.tsx) | `tests/e2e/r5-reviews.spec.ts` (6/6 auto) |
| **R6** — Actions | Add to Bag (single sticky button, acts on the active card, no exit), See product, two-tier Remove (heart = unsave from wishlist, X = remove from this comparison only) with Undo | [`compare/page.tsx`](src/app/compare/page.tsx), [`CompareCarousel.tsx`](src/components/compare/CompareCarousel.tsx), [`product/[id]/page.tsx`](src/app/product/%5Bid%5D/page.tsx) | `tests/e2e/r6-actions.spec.ts` (10/10 auto), `tests/e2e/compare-two-tier-remove.spec.ts` |

Cross-cutting checks (`docs/ACCEPTANCE.md` §X) — no Myntra host anywhere in the repo, no
category beyond Shirts/Pants, zero console errors across the full flow, every tap target
≥44×44px, the app runs with zero env vars set — are in `tests/e2e/x-cross-cutting.spec.ts` plus
a `grep` pre-flight (see [Deploying](#deploying)).

## Beyond the PRD: wishlist redesign & comparison decision-support

Operator-directed, after the six R-numbered requirements above were built — see
[`DECISIONS.md`](DECISIONS.md) D7 and D8 for the full reasoning, including two places where a
visual reference the operator shared (a real Myntra screenshot, then a standalone HTML
prototype) pulled against `RULES.md`'s hard constraints, and how each was resolved.

- **Wishlist screen**, adapted toward that screenshot within the rules (D7): [`ProductTile.tsx`](src/components/wishlist/ProductTile.tsx)
  gained a rating badge, an Add-to-Bag pill, a delivery estimate, and a delete/move-to-bag/share
  icon row; [`CategoryTabs.tsx`](src/components/wishlist/CategoryTabs.tsx) became a circle-icon
  rail (still exactly All/Shirts/Pants — RULES B1); [`CompareIntroBanner.tsx`](src/components/wishlist/CompareIntroBanner.tsx)
  replaces the screenshot's cashback banner with a non-promotional explainer (RULES B2); and
  [`OutOfStockFilterPill.tsx`](src/components/wishlist/OutOfStockFilterPill.tsx) is a real,
  inventory-backed filter, not a decorative one. Verified by `tests/e2e/wishlist-tile-actions.spec.ts`
  and `tests/e2e/wishlist-outofstock-filter.spec.ts`.
- **Compare screen rebuilt to match an operator-supplied HTML prototype** (D8): a compact
  swipeable carousel ([`CompareCarousel.tsx`](src/components/compare/CompareCarousel.tsx))
  replaces the old full-height per-card attribute stack, with a shared
  [`AtAGlanceTable.tsx`](src/components/compare/AtAGlanceTable.tsx) (Price/Rating/Your size/
  Delivery) and [`DetailsTable.tsx`](src/components/compare/DetailsTable.tsx) (Fit/Material/
  Sizes) below it — real per-item values in a CSS grid, with the column matching the carousel's
  centered card highlighted. [`lib/compareStats.ts`](src/lib/compareStats.ts) still computes
  "Lowest price"/"Best rated" [`LeaderChip.tsx`](src/components/compare/LeaderChip.tsx) markers
  per attribute (RULES B3's own parenthetical explicitly allows this — a neutral factual
  marker, never a card-level winner), now shown on the carousel slide. Two-tier removal (heart
  = unsave from the wishlist entirely, X = remove from this comparison only) both offer an
  Undo action on their toast. Verified by `tests/e2e/compare-leader-chips.spec.ts` (pure
  tie-break-logic tests plus a banned-language grep scoped to exclude the pick card below),
  `tests/e2e/compare-at-a-glance-table.spec.ts`, and `tests/e2e/compare-two-tier-remove.spec.ts`.
- **"Our pick for you"** ([`PickForYouCard.tsx`](src/components/compare/PickForYouCard.tsx),
  [`lib/pickForYou.ts`](src/lib/pickForYou.ts)) — an explicit, operator-directed **override**
  of RULES B3's "no automated winner" constraint, not a judgement call made on the app's own
  initiative (see D8 for the exact reasoning and the rule text it overrides). Every reason
  shown is computed from real deck data (size availability, rating, a real price delta against
  a real more-expensive item in the set) — the override is about whether a verdict is shown at
  all, not license to fabricate the reasoning behind it. Verified by `tests/e2e/pick-for-you.spec.ts`.

## What's mocked vs. real

| | |
|---|---|
| **Real** | The interaction itself — selection, swipe, alignment, session persistence. The size recommendation/availability *logic* and the live in-session stock-change mechanism. The LLM summarization pipeline: real Gemini calls, real threshold gating, real anti-sycophancy validation with a real retry — when `GEMINI_API_KEY` is set. |
| **Mocked** | The catalog (16 hand-authored products), reviews (346 synthetic, written for this project — see `RULES.md` A5), inventory, and size-profile are all seed JSON in `/data`, not live services. Product photography is generated (deterministic SVG flat-lays rasterized to JPEG), not sourced — see [`DECISIONS.md`](DECISIONS.md) D3 for why and how to swap in real photos later. Each product's delivery estimate is likewise fabricated-but-deterministic, generated once at seed time (D7), not a real courier quote. Without a Gemini key, review summaries fall back to hand-written precomputed themes rather than a live call. |

Every mock sits behind a function signature a real service could satisfy unchanged —
`docs/ARCHITECTURE.md` §9 maps each one to its production equivalent.

**On the PRD's own open question** (§9: can the size/fit service answer fast enough not to slow
the swipe?) — this MVP doesn't actually test that constraint, since the recommendation lookup
is synchronous local data (sub-millisecond). The real constraint in production would be the
network hop this MVP doesn't have; `lib/size.ts`'s `getRecommendedSize` is deliberately
single-brand-at-a-time so swapping it for a batched network call at deck-open time (the
pattern `lib/summarize.ts` already uses for the LLM) is a one-function change, not a redesign.

## Judgement calls

Every place the spec was silent or (twice) internally inconsistent is logged with reasoning in
[`DECISIONS.md`](DECISIONS.md) — including the operator-directed Groq→Gemini substitution, why
signalled-brand size signals are kept single-category, why the scripted stock event resolves
against the live deck instead of a hardcoded SKU, a real bug (native image drag-and-drop
silently swallowing the swipe gesture for mouse/trackpad users) found and fixed while writing
the acceptance suite, (D7) the operator-directed wishlist redesign and compare-card
decision-support features, and (D8) the compare screen's rebuild to match an operator-supplied
HTML prototype — including an explicit, recorded operator override of the "no automated
winner" hard rule for the "Our pick for you" card.

## Testing

```bash
npx playwright install chromium   # once
npx playwright test               # builds, starts a production server, runs all 77 specs
```

Runs against a production build (`next build && next start`), not `next dev` — matching how
the app actually ships, at the real 390×844 mobile viewport RULES.md targets. All auto rows
in `docs/ACCEPTANCE.md` pass (R3's rows were updated in place for the D8 rebuild — see the note
at the top of that section), plus specs covering the operator-directed features in
[Beyond the PRD](#beyond-the-prd-wishlist-redesign--comparison-decision-support) above
(`wishlist-tile-actions`, `wishlist-outofstock-filter`, `compare-leader-chips`,
`compare-at-a-glance-table`, `compare-two-tier-remove`, `pick-for-you`). The manual rows
(visual weight, skeleton-vs-spinner, Lighthouse,
a real-phone pass) were checked by hand; Lighthouse mobile against `/wishlist` (production
build) scored 96 performance / 100 accessibility, both comfortably past the ≥85 / ≥95 bar —
see `DECISIONS.md` D6 for the specific fixes that got accessibility there (it started at 89).

## Deploying

```bash
npx tsc --noEmit && npm run lint && npm run validate:data && npm run build && npx playwright test
grep -ri "myntassets\|myntra\.com" --include="*.ts*" --include="*.json" src/ data/ && echo "VIOLATION" && exit 1
npx vercel login    # one-time browser auth — see .claude/skills/ship-to-vercel
npx vercel --prod
npx vercel env add GEMINI_API_KEY production && npx vercel --prod   # redeploy so the key takes
```

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS v4 · framer-motion · Zustand
(`persist` on sessionStorage) · Zod · lucide-react · Manrope (`next/font/google`, self-hosted
at build time) · Google Gemini (`gemini-3.6-flash`, via plain `fetch`, no SDK) · Vercel ·
Playwright. No database — everything is seed JSON plus session state, by design (`CLAUDE.md`
§3).
