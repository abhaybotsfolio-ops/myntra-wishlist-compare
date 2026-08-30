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

## D7 — Wishlist redesign + compare-card comparison markers (operator-directed)

Not a PRD-silence judgement call — the operator shared a real Myntra wishlist screenshot and
asked for two coupled changes: (1) the wishlist screen adapted toward that visual reference,
and (2) the compare card reframed from PDP-style per-product attributes toward cross-product
decision support ("lowest price among selected", "best reviews among selected"), plus an
explicit invitation to ideate further features. `CLAUDE.md`/`RULES.md` still govern how far
either can go — this entry records where the reference screenshot and the hard rules pulled
in different directions, and what was actually built.

**RULES B3's parenthetical is what makes the second half legitimate at all:** "No automated
winner... Attribute values may be visually compared (e.g. showing which price is lowest is
acceptable as a neutral factual marker) but the app must never tell the user which item to
pick." Every new comparison element below was designed to stay inside that carve-out — a
single-attribute factual marker attached to the row it describes, never an aggregate score,
never a highlighted card, never ranking/reordering the deck.

**Wishlist screen — what was adapted vs. dropped, and why:**
- The screenshot's category-circle rail (Shirts, Tshirts, Track Pants, Sweaters, Jeans,
  Casual Shoes, Jackets) directly conflicts with RULES B1 ("Shirts and Pants only... no other
  category appears anywhere in the UI, including in filter chips"). `CategoryTabs.tsx` was
  restyled to circle icons but kept to the exact same three values (All Items/Shirts/Pants) —
  no new category was introduced. The (real) lack of a lucide-react "pants" icon is solved
  with a small inline SVG glyph, not a new dependency (RULES D4/F5).
- The screenshot's cashback promo banner directly conflicts with RULES B2 (no coupon/discount/
  urgency content). `CompareIntroBanner.tsx` occupies the same visual slot but explains the
  Compare feature itself instead — no discount language, suppressed entirely below the
  selection floor (`SELECTION_MIN`) since there's nothing to compare yet.
- The screenshot's "Collections" filter pill was dropped outright, not even as a decorative
  no-op — PRD §4 explicitly rules out changes to Collections, and a fake button that looks
  functional is worse than no button (CLAUDE.md rule 2: never render something that reads as
  broken or misleading).
- The screenshot's "Out of Stock" filter pill **was** built, and built real: it's backed by
  the existing `Inventory` data (`isFullyOutOfStock` in `lib/size.ts` — every size at 0 units,
  not just the recommended one), composes with the category filter (AND, via
  `filterOutOfStock` in `lib/store.ts`), and locks during selection mode for the same reason
  the category tabs already do (RULES B2's ban on urgency framing doesn't touch a
  user-initiated, factual availability filter). The seed catalog had zero fully-out-of-stock
  SKUs before this — `scripts/generate-seed.ts` now zeroes every size of
  `shirt-highlander-001` (deliberately unsignalled — see D2 — so this doesn't interact with
  any recommended-size scripting on the compare screen) specifically so the filter has
  something real to demonstrate; the seed invariant check now asserts `>=1`.
- The tile itself grew a rating badge, an Add-to-Bag pill (both overlaid on the image), a
  delivery estimate line, and a delete/move-to-bag/share icon row, all using data or actions
  that already existed elsewhere in the app (rating/ratingCount were on `Product` but unused
  on this screen; `addToBag`/`removeItem` already existed in the store) — except
  `deliveryEstimate`, which is new: a fabricated-but-deterministic string generated at seed
  time from a **second, independently-seeded** PRNG (`mulberry32(20260830 + 17)`), isolated
  from the file's main `rand` stream specifically so regenerating it doesn't shift any other
  file's random draws (verified via `git diff --stat` after regeneration — only
  `products.json` and, separately, images changed). It's the same honesty class as every
  other seeded field in this app: invented once, deterministically, not fabricated per
  request. `README.md`'s mocked-vs-real table now says so explicitly.
- A real bug surfaced by this work, not a judgement call: the placeholder product images
  (D3) baked the brand name and title directly into the JPEG. That was harmless until the
  wishlist tile grew its own bottom-left overlay (the rating badge) in the same corner, where
  the baked-in text visibly bled through it. Fixed by dropping the baked-in text from
  `svgWrap()` entirely — the tile and compare card both already render brand/title as real UI
  text, so the watermark was redundant even before it started colliding.
- `moveToBag` (remove from wishlist + add to bag in one tap) composes the two existing,
  already-tracked store actions under one `fromSurface` tag rather than adding a new
  `AnalyticsEvent` variant — RULES F6 calls that vocabulary fixed and tied to the PRD's
  success metrics, and "moved to bag" isn't one of them. Share fires no track event at all,
  for the same reason.
- The header's bag icon and the location line are both deliberately non-interactive —
  matching the same "plausible but non-functional chrome" precedent `PhoneFrame`'s fake
  status-bar clock/battery already set, rather than building a bag/cart screen or a location
  picker that isn't in scope.

**Compare card — the two features actually built (the operator explicitly declined a
review-sentiment marker and fit/material difference-highlighting when asked; only these two
were approved):**
- **Leader chips**: a small "Lowest price" / "Highest rated" chip next to the value in the
  `price`/`rating` row, on whichever card(s) hold that extreme in the *current* 2-4 item deck
  — computed by the new pure `computeDeckStats()` in `lib/compareStats.ts`. Tie-break rule: a
  chip renders on every card tied at the extreme, **except** when the entire selected deck
  shares that exact value, in which case no chip renders at all. A chip present on every
  single card in the set is technically factual but asserts nothing, and starts to read like
  a highlighted-card verdict even though each instance is individually neutral; a chip on
  some-but-not-all cards is genuinely informative and stays inside B3's carve-out.
- Adding a chip to the `price`/`rating` rows broke an assumption `CompareCard.tsx`'s own
  comment relied on: those two rows used bare `minHeight` because their content was
  "structurally fixed-shape already." A chip that's present on some cards and absent on
  others in the same deck isn't fixed-shape any more, so both rows joined `size`/`reviews` in
  the `maxHeight`-capped set that already exists for exactly this reason — with a small +4px
  bump to each row's `minH` in `ATTRIBUTE_ROWS` as headroom, not a requirement (the chip fits
  the old height comfortably for every real SKU in the catalog; the cap is what makes the R3
  pixel-alignment guarantee structurally true again rather than true by coincidence).
- **Comparison summary strip**: rendered exactly once above the swipeable deck (not per-card,
  no participation in the `ATTRIBUTE_ROWS`/`data-row` alignment mechanic, since there's only
  one instance on the page) — price range, rating range, and how many of the selected items
  are available in the shopper's recommended size. The "in your size" count's numerator *and*
  denominator are both restricted to deck items that actually carry a size signal; a
  no-signal item is excluded from the stat entirely rather than silently counted on either
  side, which is RULES C3 ("never fabricate a size opinion") applied one level up, to an
  aggregate rather than a single card. Zero signalled items in the deck suppresses the whole
  segment (`null`, rendered as nothing) rather than showing a nonsensical "0 of 0". The stat's
  own text is "N/M", deliberately not "N of M" — `PositionIndicator`'s card-position text
  ("2 of 3") can land on the exact same numbers in the same deck, and three existing
  Playwright specs' bare `getByText("N of M")` lookups broke on that collision during testing
  before the format was changed.
- Two existing Playwright locators broke for an unrelated reason surfaced by this same batch
  of work: `tests/e2e/helpers.ts`'s `selectNItems` (and one inline copy in
  `r2-selection.spec.ts`) matched wishlist checkboxes via a bare
  `button[aria-pressed="false"]` selector — the new Out of Stock filter pill is also a toggle
  button, appears earlier in the DOM, and also starts at `aria-pressed="false"`, so the bare
  selector started resolving to the (locked, disabled) filter pill instead. Fixed by scoping
  to the checkbox's `aria-label` prefix, which only a wishlist tile has.

## Format for entries below

Each entry: what the spec left open, the decision, and why it's the more-honest-to-the-user
reading per `CLAUDE.md` §6.
