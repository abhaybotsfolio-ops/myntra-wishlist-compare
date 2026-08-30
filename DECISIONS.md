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

## Format for entries below

Each entry: what the spec left open, the decision, and why it's the more-honest-to-the-user
reading per `CLAUDE.md` §6.
