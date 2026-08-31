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

## D8 — Compare screen rebuilt to match an operator-supplied HTML prototype, including an explicit override of RULES B3

The operator attached a standalone HTML/CSS/JS prototype (`myntra_compare_prototype.html`) —
a real Myntra-style compare flow with its own colour palette, typeface, and information
architecture — and asked for the app's UI to match it. Two questions were put back to the
operator before touching anything, because the prototype's actual shape and content
contradicted decisions already load-bearing elsewhere in this build:

1. **Compare screen structure.** The prototype uses a compact swipeable carousel (thumbnail,
   brand, price, rating, size — nothing else) plus a separate comparison table below it,
   not the full-height per-card attribute stack CLAUDE.md's hard rule #6 and RULES E1/E2
   describe ("Attribute rows must align pixel-for-pixel across every card"). The operator
   chose to rebuild to the prototype's shape rather than restyle the existing architecture.
2. **The prototype's "Our pick for you" card.** A literal automated recommendation with
   reasoning, in direct conflict with RULES B3 / CLAUDE.md §2's explicit, hard,
   "non-negotiable" constraint: *"No automated 'winner' or 'best pick' badge. The feature
   presents evidence; the user decides."* The operator explicitly chose to override this
   rule, understanding the conflict, rather than have it dropped or softened. This is
   recorded here per RULES.md's own statement that an explicit operator instruction takes
   precedence over the spec (the same authority already exercised once, for D0's Groq→Gemini
   substitution) — it is not a judgement call made on the app's own initiative, and
   `docs/ACCEPTANCE.md` X.2 is updated in place to point back here rather than left silently
   contradicted.

**What was actually rebuilt:**

- **Design tokens** (`src/app/globals.css`) rebased on the prototype's palette — Manrope
  (`next/font/google`, self-hosted at build time, no runtime call to Google's CDN — RULES D4)
  replaces the system font stack; `--color-brand` stays `#ff3f6c` (the prototype's pink is
  identical); `--color-ink`/`--color-canvas`/`--color-line` move to the prototype's near-black/
  near-white/hairline values. Several of the prototype's *raw* hex values fail WCAG AA as real
  text — its `--faint` is 2.34:1 against white, `--muted` 4.27:1, `--green` 3.67:1 (3.33:1
  against its own tint) — computed directly (relative luminance / contrast ratio, same formula
  D6 used) and darkened the same way D6 already handled this exact class of problem: keep the
  prototype's hue, add real margin above 4.5:1 against both `--color-surface` and
  `--color-canvas`. `--color-ink-muted` and `--color-ink-faint` in particular needed enough
  separation from each other, after darkening, to still read as two distinct tiers rather than
  converging on the same grey.
- **Wishlist tile**: restyled to the prototype's rounded-card-with-border language and
  moved the selection circle from top-right to top-left (prototype convention) — the richer
  tile content added earlier this session (rating badge, delivery estimate, Add-to-Bag pill,
  icon row — see the wishlist-redesign commits) was kept and reskinned, not reverted; the
  prototype's own tile is simpler, but the operator's ask here was visual-language alignment,
  not a feature rollback.
- **`src/components/compare/CompareCarousel.tsx`** replaces `CompareDeck.tsx`/`CompareCard.tsx`
  — same framer-motion drag mechanics (drag="x", dragElastic 0.12, snap on velocity>500 or
  displacement>30%, spring `{stiffness:320, damping:34}`), but each slide is now a compact
  identity card (~150px wide: image, brand/title, `RatingPill` in a green-tint pill, price,
  `SizeLine`, a "See product" link) instead of a full attribute stack. `AlignmentOverlay.tsx`
  and `ATTRIBUTE_ROWS`/`AttributeRowKey` (`lib/constants.ts`) are retired along with them —
  the mechanic they existed to protect (per-card row alignment) no longer has a per-card row
  system to protect.
- **`AtAGlanceTable.tsx`** (Price/Rating/Your size/Delivery) and **`DetailsTable.tsx`**
  (Fit/Material/Sizes) replace `SummaryStrip.tsx` — real per-item values in a CSS grid, not a
  min–max range summary, with the column matching the carousel's centered card highlighted in
  pink-tint. The prototype's table also shows Colour/Occasion/Key-features/Returns rows; none
  of those exist in this app's `Product` schema, and inventing shallow one-line values to match
  the reference more literally would be exactly the class of fabrication RULES.md polices
  elsewhere (never a guessed size, never an invented review theme) — so those rows were left
  out rather than invented, and only real, already-modeled fields made the table.
- **`SizeLine.tsx`** replaces `SizeWedge.tsx` for the carousel — same four states (no-signal /
  loading / unavailable / available-or-low), same RULES C3 honesty rule (basis string always
  shown alongside a real recommendation, in *every* non-loading branch, including
  unavailable — a real regression caught while rewriting the acceptance suite: an earlier
  version of this file dropped the basis text specifically on the unavailable branch), just
  laid out for a ~150px slide instead of a 76px full-width row. A "Notify me when {size} is
  back" affordance was added on the unavailable branch (matching the prototype) — it raises a
  toast only, no real notification backend exists or is implied to a degree beyond what the
  copy says; this is the same class of harmless, honestly-scoped micro-interaction as the
  header's decorative bag icon.
- **Two-tier removal**, matching the prototype: the heart icon unsaves from the wishlist
  entirely (cascading out of the active comparison too, via the existing `removeItem`); the
  new X icon (`removeFromDeck` in `lib/store.ts`) removes from *this comparison only*, leaving
  the item on the wishlist. Both actions' toasts carry an "Undo" affordance (also new —
  `toast-bus.ts`'s `ToastMessage` gained optional `actionLabel`/`onAction` fields, rendered by
  `Toast.tsx`), restoring the item to its exact pre-removal index in the wishlist and/or deck
  arrays via new `restoreWishlistItem`/`restoreDeckItem` store actions. Neither `removeFromDeck`
  nor the Undo restores fire a new `AnalyticsEvent` variant — same reasoning as `moveToBag`
  and `share` before them (RULES F6 keeps that vocabulary fixed and tied to PRD metrics, and
  none of these are PRD metrics).
- **Add to Bag** moved from one button per card to a single sticky button at the page level,
  acting on whichever card is currently centered in the carousel — still satisfies RULES E3
  (pinned, reachable without scrolling) and CLAUDE.md's hard rules #7/#8 (removing/adding
  never exits or advances comparison), just structurally simpler now that there's one deck-
  level action surface instead of N per-card ones. The prototype also has a "Buy now" button
  alongside "Add to cart" — dropped; CLAUDE.md §2 rules out "real payments, real checkout"
  outright, and there is nothing behind a Buy Now button in this app that isn't already
  behind Add to Bag.
- **`lib/pickForYou.ts`** — the operator-overridden recommendation itself. Mirrors the
  prototype's algorithm (prefer items available in the shopper's size, falling back to the
  full set if none are; highest rating, tie-broken by lower price) but every reason shown is
  computed from real deck data (`recommendation`/`status`, `rating`/`ratingCount`, a real price
  delta against a real more-expensive item in the set) — the override is about *whether* a
  verdict is shown at all, not a license to fabricate the reasoning behind it. `PickForYouCard`
  renders it in its own clearly-labeled "OUR PICK FOR YOU" section, visually and structurally
  separate from the neutral per-attribute leader chips, so a reviewer (or a test) can't
  mistake the two for the same mechanic.
- Leader chips ("Lowest price" / "Best rated") — unchanged in logic (`lib/compareStats.ts`,
  untouched by this rebuild) but re-homed onto the carousel slide's header row instead of the
  old card's price/rating rows. A real layout bug was found and fixed while building this: the
  header row initially absolutely-positioned the heart/X icons and the leader chip(s)
  independently, and a card with two stacked chips ("Lowest price" + "Best rated" on the same
  item) had its chip text visually collide with both icons — fixed by rebuilding the row as an
  ordinary flex row (icon / chip column / icon) instead of absolute overlays, so 0, 1, or 2
  chips can never collide with the icons regardless of how much text they hold.
- A second real bug, same root cause pattern as D5: the heart/X/prev/next icon buttons were
  initially sized at their *visual* 36px, under RULES E7/X.7's 44×44 tap-target minimum,
  caught by the rewritten `x-cross-cutting.spec.ts` X.7 sweep. Fixed with the same pattern
  already used for the wishlist tile's Add-to-Bag pill: a 44×44 invisible hit area around a
  visually smaller (36px) circle, so the compact aesthetic and the tap-target rule both hold.

## D9 — Post-launch feedback: carousel centering bug, "AI-recommended" size copy, dropped the stock-change toast

Three small, operator-directed fixes made after actually using the D8-rebuilt compare screen,
none of them PRD-silence judgement calls.

- **A real centering bug.** `CompareCarousel.tsx`'s width measurement (`containerRef.current.
  offsetWidth`) was taken on the same element that also carried `px-9` horizontal padding.
  Tailwind's preflight sets `box-sizing: border-box`, so `offsetWidth` already includes that
  padding — every slide was sized 72px too wide (390px instead of the true 318px content
  width) and its centered content drifted right by exactly half that, 36px, matching what the
  operator actually saw. Fixed by removing the padding from the measured container entirely —
  it wasn't protecting anything: the 44px prev/next arrows sit at `left-1`/`right-1` (4px from
  the true edge), well clear of the ~150px-wide centered slide content even at zero padding.
- **"AI-recommended size", not "Your size".** Operator feedback: the size line, the At a
  glance table's row label ("Your size" → "AI size"), and the "Our pick for you" reasoning
  sentence all now say "AI-recommended size" — a copy change only. `lib/size.ts`'s
  `getRecommendedSize` and everything it's built on (purchase history / return signals, RULES
  C3's honesty rule) are unchanged; this only renames how the result is presented, the same
  way many products label a rules-based personalization result "AI" for the shopper without
  that changing the underlying mechanism or its accuracy guarantees.
- **Dropped the stock-change toast.** `useInventory.ts` used to pair the scripted mid-session
  stock-drop (R4.7, DECISIONS.md D4) with a toast — "Size X just went out of stock for the Y
  item". Operator feedback: an alert appearing unprompted, mid-session, for an action the user
  never took read as a confusing interruption rather than a helpful live-update cue ("why is
  there a sudden prompt"). The toast call was removed; the underlying poll, the
  `stock_changed_in_session` tracking, and the scripted event resolution (`stock-simulator.ts`)
  are all unchanged — `SizeLine` and `AtAGlanceTable` still flip to the unavailable state in
  place when the event fires, which is what actually demonstrates "this isn't a static page,"
  just without the interruption. `docs/ACCEPTANCE.md` 4.7 updated to match.

## D10 — Live Gemini deployment debugging: two real, unrelated causes, found by adding a temporary diagnostic endpoint rather than guessing

Not a judgement call — a debugging log, kept because the method is worth recording along with
the result. After deploying (D8/D9) and adding `GEMINI_API_KEY` on Vercel, `/api/summarize`
kept returning `source: "fallback"` in production with zero server-side errors logged, which
made the two real causes underneath it genuinely ambiguous from the outside — the fallback
path is deliberately silent and indistinguishable-by-design from a working-but-unused key
(RULES: "nothing in the UI announces a failure"). Rather than keep guessing across several
rounds of "check the Vercel dashboard," a temporary route,
`src/app/api/debug-gemini/route.ts`, was added and deployed — it reports whether
`process.env.GEMINI_API_KEY` is present (boolean/length only, never the value) and, if so,
makes one real Gemini call and returns Gemini's own raw HTTP status and body. This turned two
rounds of back-and-forth into two direct, conclusive answers:

1. **`hasKey: false`.** The key had been added under Vercel's **Development** environment
   (Vercel's current dashboard splits Production/Preview/Development into separate
   environment-scoped variable sets, not one list with checkboxes), not Production — so the
   live deployment's runtime never saw it at all, regardless of how many times it was
   redeployed. Fixed by adding the same variable under the Production environment specifically.
2. **`hasKey: true`, but a live 404 from Gemini itself**: `"This model models/gemini-2.0-flash
   is no longer available... use models/gemini-3.6-flash."` Google retired the model this
   project was built against sometime after the original build. `lib/summarize.ts`'s
   `GEMINI_MODEL` constant (and the now-deleted diagnostic route, and every doc that named the
   model — `CLAUDE.md`'s stack table, `README.md`'s Stack section, the `review-summarizer`
   skill) updated to `gemini-3.6-flash` — confirmed against the API's own error message, not
   guessed. `DECISIONS.md` D0 (the original Groq→Gemini choice) is left as-is since it's an
   accurate record of that decision at the time it was made; this entry is the update, not a
   rewrite of history.

The diagnostic route was deleted once both were confirmed fixed — it was never part of the
shipped feature set (RULES F5), and leaving a public, unauthenticated endpoint that triggers a
real Gemini API call on every hit isn't something to leave running in "production."

## Format for entries below

Each entry: what the spec left open, the decision, and why it's the more-honest-to-the-user
reading per `CLAUDE.md` §6.
