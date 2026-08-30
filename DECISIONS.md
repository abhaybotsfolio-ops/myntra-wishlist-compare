# DECISIONS.md

Judgement calls made during the build where the spec bundle was silent, or where the operator
gave an explicit instruction that overrides the spec bundle. Newest at the bottom, in build order.

---

## D0 — LLM provider: Gemini instead of Groq (operator-directed)

**Spec said:** `CLAUDE.md` §3 pins Groq (`llama-3.3-70b-versatile`) and calls the stack table
"decided — do not substitute." The `review-summarizer` and `ship-to-vercel` skills, and every
mention of the summarization env var across `RULES.md`, `docs/ARCHITECTURE.md`,
`docs/BUILD_PLAN.md`, and `docs/ACCEPTANCE.md`, were written around Groq specifically.

**What changed:** The operator explicitly asked for Google Gemini instead, and chose
`gemini-2.0-flash` when offered a choice between that and `gemini-2.5-flash`. This is not a
PRD-silence judgement call — it's a direct operator instruction, which RULES.md itself says
takes precedence.

**How it was applied:**
- Every copy of the spec bundle in this repo (`CLAUDE.md`, `RULES.md`, `docs/`,
  `.claude/skills/`) was edited in place so the committed docs describe what was actually
  built, not what the original template said. `GROQ_API_KEY` → `GEMINI_API_KEY` throughout;
  `console.groq.com/keys` → `aistudio.google.com/apikey`.
- `/api/summarize` calls the Gemini REST endpoint
  (`generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`) with
  plain `fetch` — no `@google/generative-ai` SDK dependency, keeping Phase 0's "nothing else"
  dependency list intact (RULES F5, D4). Gemini's `generationConfig.responseMimeType:
  'application/json'` is the equivalent of Groq/OpenAI's `response_format: {type:
  'json_object'}`; the outbound JSON is still re-validated with Zod regardless.
- Everything else about R5 — threshold gate, anti-sycophancy post-validation, retry-once,
  fallback-first build order, caching, timeouts — is unchanged from the spec's design intent.
  Only the provider and env var name moved.

## D1 — Summary.themes: conditional min, not a flat min(2)

**Spec said:** `docs/DATA_MODEL.md`'s `Summary` schema writes
`themes: z.array(Theme).min(2).max(3)`, commented `// empty when insufficient`. Those two
things contradict each other — a flat `.min(2)` rejects the `[]` that the same doc's
`review-summarizer` skill returns for the below-threshold case
(`{ status: 'insufficient_reviews', themes: [] }`).

**Decision:** `data/schema.ts` keeps `themes` as `.max(3)` unconditionally and enforces the
real invariant with `superRefine`: `status: 'ok'` requires 2–3 themes, `status:
'insufficient_reviews'` requires zero. This is what both call sites actually need, and it's
stricter than just dropping the lower bound would have been.

## D2 — Signalled brands are single-category

**Spec said:** `SizeSignal` is `{brand, size, confidence, source, basis}` — no category field — and the
size-wedge skill pins `getRecommendedSize(profile, brand)`'s signature with brand only, no
category argument. Neither doc addresses what happens if one brand sells both shirts (alpha
sizes: S–XXL) and pants (numeric waist: 28–38): a single signal can't honestly recommend two
differently-scaled sizes at once.

**Decision:** every brand that carries a size signal appears in exactly one category in the
catalog (e.g. Roadster is shirts-only, Levi's is pants-only). The catalog only has 9 real
brand names to work with (RULES A4 + the catalog-seed skill's list, taken as the exhaustive
allowlist, not just examples — inventing a 10th real-sounding brand name seemed like the
worse risk), so full non-overlap across all 16 products isn't possible; the two deliberately
*unsignalled* brands (Highlander, WROGN) are the ones exempt from this, since "no signal"
is unambiguous regardless of category. This is what makes `getRecommendedSize(profile,
brand)`'s signature honest as written, rather than silently wrong for a hypothetical
brand that sells both.

## D3 — Product imagery is generated, not sourced

**Spec said:** catalog-seed skill: download real Unsplash/Pexels photography, two per SKU,
committed with `CREDITS.md` attribution — with an explicit sanctioned fallback: "If the
network is unavailable, generate deterministic SVG placeholders... Ugly is acceptable;
broken is not."

**Decision:** generated placeholders for all 32 images, not because the network was down
(it wasn't) but because individually sourcing and vetting 32 correctly-licensed, on-theme
photos was a poor time trade against the seven build phases still ahead, and the skill
explicitly sanctions this path rather than only permitting it under a literal network
outage. `scripts/generate-seed.ts` builds each as one coherent SVG silhouette (a real closed
outline — collar/placket/pocket for shirts, waistband/fly/legs for pants — not a stock
"garment icon"), colored per-product from a curated palette, brand name and product title
rendered as type per the skill's own spec for what the placeholder should contain, then
rasterizes to JPEG with `sharp` (already present as `next`'s own optional dependency, so
this adds nothing to Phase 0's dependency list) at 800×1067, all well under the 120KB budget.
`public/products/CREDITS.md` says plainly that these are generated, not photographed, so
nobody mistakes them for sourced work needing attribution. Swapping in real photography
later touches only that folder — every other file references images by path only.

## D4 — Stock event target is resolved against the actual deck, not read literally from the seed file

**Spec said two different things.** `docs/DATA_MODEL.md`'s `StockEvent` has a fixed `sku`
and `size` per event — reads as "this exact SKU drops at this exact time." But the
`size-wedge` skill describes resolving the event dynamically: "At `comparison_started`,
resolve the event against the actual deck — pick a SKU the user selected that is currently
available in their recommended size," specifically because a fixed-SKU event only fires if
the user happens to pick that one product, which the same skill calls out as "a demo
behaviour that will not fire in front of the reviewer."

**Decision:** treat `data/stock-events.json`'s `sku`/`size` as illustrative and use only its
`atMs` timings. `lib/stock-simulator.ts#resolveStockEvents(deckSkus)` picks real targets at
request time — a deck SKU whose brand has a signal and is currently `available` in that
recommended size — deterministically (first eligible candidate per timing slot, not random).
This guarantees the scripted stock-change is visible in *any* 2-4 item deck a demo viewer
picks, not only one that happens to include the two specific SKUs named in the seed file.

`/api/inventory` applies this statelessly: the client passes `deckStartedAt` (set once, in
the store, when `confirmSelection()` freezes the deck) on every poll, and the server compares
`Date.now() - deckStartedAt` against the resolved events' `atMs` on each request — no
server-side session memory needed, so it's correct across cold starts and warm-lambda reuse
alike, and naturally keeps counting correctly through a backgrounded tab (RULES/R3's
"persists if the user backgrounds the app and returns" applies to elapsed real time here too,
not just to the deck contents).

## D5 — `draggable={false}` on every product Image (found via Playwright, not a product decision, but worth recording)

Not a PRD-silence judgement call like the others — a real bug found while writing the Phase 9
acceptance tests, worth recording because the symptom was badly misleading and the fix is easy
to accidentally revert.

**Symptom:** `tests/e2e/r3-deck.spec.ts` 3.2 (drag-swipe) hung for the full 30s test timeout.
Root-caused by bisection: a synthetic `mouse.down()` followed by `mouse.move()` over the
card's `next/image` never resolved — reproduced with `drag` removed from the `motion.div`
entirely, so it had nothing to do with framer-motion, the drag gesture code, or anything in
this codebase's own logic. `<img>` elements are natively draggable in every browser (the
built-in "drag this image out" affordance); starting a mouse-held drag on top of one hands the
gesture to the browser's native HTML5 drag-and-drop system instead of firing the ordinary
pointer-move events framer-motion (and Playwright's synthetic mouse simulation) expect, and
the two never hand back off to each other.

**Fix:** `draggable={false}` on every `<Image>` in the app (compare card, wishlist tile, PDP),
not only the compare card where R3's swipe lives — the same native-drag conflict would await
anyone who later added a gesture near any of the others. Confirmed the fix by bisecting further:
removing `drag="x"` alone did *not* unblock the hang; adding `draggable={false}` did, both with
and without `drag="x"` present.

**Why this stayed hidden through all of Phase 5-6's manual browser testing:** touch input
(what a real phone sends, and what most of this session's interactive testing used) doesn't
trigger HTML5 drag-and-drop the way a held mouse button does — RULES E7's "must work with a
trackpad on desktop" is exactly the case that exposes it, and is also exactly the case an
E2E suite using `page.mouse` exercises. A demo done entirely by touch/swipe would never have
surfaced this; anyone actually using a trackpad or mouse to drag a card would have hit a dead
gesture every time.

## D6 — Darkened four color tokens for text contrast (Lighthouse a11y 89 -> 100)

Not a product decision either, but the same "record real findings, not just PRD-silence
calls" spirit as D5. BUILD_PLAN Phase 9 sets a hard ≥95 accessibility bar; a first Lighthouse
run against `/wishlist` (production build) scored 89.

**What Lighthouse found, all real:**
- `--color-ink-faint` (#94969f) is 2.95:1 against white — fails WCAG's 4.5:1 for normal text —
  and it's used as actual small text throughout (struck MRP, rating count, size-wedge basis,
  "from N reviews"), not just decoration.
- `--color-discount` (#ff905a) is 2.2:1 as the "% OFF" text color.
- `--color-brand` (#ff3f6c) is 3.4:1 as text (Button's ghost variant, "See product") — fine as
  a background/CTA fill, not as small text.
- `--color-positive` (#03a685) is 3.1:1 as text (only the two "Added to Bag" bagged-state
  labels use it as text; every other use is a background tint, dot, or icon fill, which have a
  looser 3:1 non-text threshold and already pass).
- `maximumScale: 1` in the viewport meta tag disables pinch-zoom — a real barrier for
  low-vision users, not just an audit checkbox.
- No `<main>` landmark.
- Wishlist tile links had a hand-written `aria-label` that didn't include the tile's full
  visible content (price), failing "accessible name reflects visible content" (WCAG 2.5.3).

**Fixes:** darkened `ink-faint` and `discount` in place (they're text-only tokens, safe to
change globally); added `--color-positive-text` as a darker-for-text sibling rather than
darkening `--color-positive` itself, since that token's background-tint/dot/icon uses were
already fine and are the ones the myntra-ui skill actually specifies the hex for; swapped
`text-brand` for the existing `--color-brand-dark` at the two small-text call sites (Button's
ghost variant, CardActions' "See product") rather than inventing a new token; removed
`maximumScale`; changed `PhoneFrame`'s scroll container from a `<div>` to a `<main>`; removed
the tile link's custom `aria-label` so its accessible name is derived from its own visible
content instead of a hand-written summary of it.

## Format for entries below

Each entry: what the spec left open, the decision, and why it's the more-honest-to-the-user
reading per `CLAUDE.md` §6.
