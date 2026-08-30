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
| **R3** — Swipe deck | `ATTRIBUTE_ROWS`-mapped cards, framer-motion drag, dots + "N of M", session persistence | [`CompareDeck.tsx`](src/components/compare/CompareDeck.tsx), [`CompareCard.tsx`](src/components/compare/CompareCard.tsx), [`lib/constants.ts`](src/lib/constants.ts) | `tests/e2e/r3-deck.spec.ts` (8/8 auto) — 3.5 measures `getBoundingClientRect().top` across every card, not a visual spot-check |
| **R4** — Size wedge | Recommendation (brand lookup, never a guess), live inventory-backed availability, scripted stock-change event | [`lib/size.ts`](src/lib/size.ts), [`lib/stock-simulator.ts`](src/lib/stock-simulator.ts), [`SizeWedge.tsx`](src/components/compare/SizeWedge.tsx), [`useInventory.ts`](src/lib/useInventory.ts) | `tests/e2e/r4-size.spec.ts` (8/8 auto) |
| **R5** — Review summary | Gemini-backed themes, threshold gate, anti-sycophancy validator | [`lib/summarize.ts`](src/lib/summarize.ts), [`ReviewSummary.tsx`](src/components/compare/ReviewSummary.tsx) | `tests/e2e/r5-reviews.spec.ts` (6/6 auto) |
| **R6** — Actions | Add to Bag (pinned, no exit), See product, Remove (index-aware, redirects below 2) | [`CardActions.tsx`](src/components/compare/CardActions.tsx), [`compare/page.tsx`](src/app/compare/page.tsx), [`product/[id]/page.tsx`](src/app/product/%5Bid%5D/page.tsx) | `tests/e2e/r6-actions.spec.ts` (10/10 auto) |

Cross-cutting checks (`docs/ACCEPTANCE.md` §X) — no Myntra host anywhere in the repo, no
category beyond Shirts/Pants, zero console errors across the full flow, every tap target
≥44×44px, the app runs with zero env vars set — are in `tests/e2e/x-cross-cutting.spec.ts` plus
a `grep` pre-flight (see [Deploying](#deploying)).

## What's mocked vs. real

| | |
|---|---|
| **Real** | The interaction itself — selection, swipe, alignment, session persistence. The size recommendation/availability *logic* and the live in-session stock-change mechanism. The LLM summarization pipeline: real Gemini calls, real threshold gating, real anti-sycophancy validation with a real retry — when `GEMINI_API_KEY` is set. |
| **Mocked** | The catalog (16 hand-authored products), reviews (346 synthetic, written for this project — see `RULES.md` A5), inventory, and size-profile are all seed JSON in `/data`, not live services. Product photography is generated (deterministic SVG flat-lays rasterized to JPEG), not sourced — see [`DECISIONS.md`](DECISIONS.md) D3 for why and how to swap in real photos later. Without a Gemini key, review summaries fall back to hand-written precomputed themes rather than a live call. |

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
against the live deck instead of a hardcoded SKU, and a real bug (native image drag-and-drop
silently swallowing the swipe gesture for mouse/trackpad users) found and fixed while writing
the acceptance suite.

## Testing

```bash
npx playwright install chromium   # once
npx playwright test               # builds, starts a production server, runs all 47 specs
```

Runs against a production build (`next build && next start`), not `next dev` — matching how
the app actually ships, at the real 390×844 mobile viewport RULES.md targets. All 47 auto rows
in `docs/ACCEPTANCE.md` pass. The manual rows (visual weight, skeleton-vs-spinner, Lighthouse,
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
(`persist` on sessionStorage) · Zod · lucide-react · Google Gemini (`gemini-2.0-flash`, via
plain `fetch`, no SDK) · Vercel · Playwright. No database — everything is seed JSON plus
session state, by design (`CLAUDE.md` §3).
