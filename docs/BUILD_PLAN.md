# BUILD_PLAN.md

Nine phases. Work them in order. Commit at the end of each with the phase name in the message.
`npx tsc --noEmit` and `npm run build` must be clean before every commit.

Each phase has an **exit gate**. Do not start the next phase until the gate passes. If a gate
fails twice, record the problem in `DECISIONS.md`, take the simplest path that satisfies the
PRD criterion, and move on — do not stall the build on polish.

---

## Phase 0 — Scaffold

- `npx create-next-app@latest` — TypeScript, Tailwind, App Router, `src/`, no ESLint prompt fuss.
- Add `framer-motion`, `zustand`, `zod`, `lucide-react`. Nothing else.
- `.gitignore` covers `.env.local`. Commit `.env.example` with `GEMINI_API_KEY=`.
- `git init`, first commit.
- Copy this spec bundle (`CLAUDE.md`, `RULES.md`, `docs/`, `.claude/skills/`) into the repo.

**Gate:** dev server runs, `npm run build` clean.

## Phase 1 — Design system and phone frame

Load the `myntra-ui` skill first.

- Tailwind v4 theme tokens, typography scale, the Myntra-adjacent palette.
- `PhoneFrame` — on viewports ≥768px, render the app in a centred 390×844 device frame with a
  subtle backdrop. Below that, full-bleed. One layout, not two.
- Primitives: `Button`, `Badge`, `Toast` (with a provider), `Sheet`, `Skeleton`.
- A `/kitchen-sink` dev-only route rendering every primitive in every state. Delete before final deploy.

**Gate:** the kitchen sink looks like a shipped product, not a wireframe.

## Phase 2 — Seed data

Load the `catalog-seed` skill first.

- Write `data/schema.ts` (Zod) first, then generate data that validates against it.
- 16 products, review corpora in the four volume bands from `DATA_MODEL.md`, inventory,
  size profile with two brands deliberately unsignalled, stock events, fallback summaries.
- Download and commit product imagery to `/public/products/`, with `CREDITS.md`.
- A `npm run validate:data` script that Zod-parses every file and exits non-zero on failure.

**Gate:** `npm run validate:data` passes; every image loads locally; no Myntra URL anywhere
in the repo (`grep -ri myntassets . && exit 1`).

## Phase 3 — Wishlist screen (R1)

- Zustand store per `ARCHITECTURE.md` §4, with `persist` on sessionStorage.
- Wishlist grid, two-column, Myntra-style tiles.
- Category tabs: All Items / Shirts / Pants.
- Compare CTA at the top of the list. **Disabled with a visible reason on All Items** —
  prefer disabled-with-tooltip over hidden; a reviewer needs to see that the rule exists.
- Also disable when the active category has fewer than 2 items, with its own reason.
- Emit `wishlist_viewed`, `compare_tapped`.

**Gate:** R1 acceptance criteria pass. Tapping Compare enters selection mode without a
route change.

## Phase 4 — Selection mode (R2)

- Selection overlay on tiles: checkbox affordance, selected state, dimmed-but-tappable
  unselected state.
- Cap at 4. The 5th tap fires a toast ("You can compare up to 4 items at a time") and
  `selection_limit_hit`. Never a silent no-op.
- Cross-category selection is impossible by construction — selection mode is scoped to the
  active category and the tabs are locked while selecting.
- Sticky bottom bar: live count, "Compare 3", disabled below 2, with a Cancel affordance.
- Deselect works; scroll position is preserved on entering and leaving selection mode.

**Gate:** all four R2 criteria pass, including scroll-position preservation.

## Phase 5 — Compare deck (R3)

- `ATTRIBUTE_ROWS` constant exactly as in `ARCHITECTURE.md` §6.
- `CompareDeck` with framer-motion drag: horizontal drag, velocity-aware snap, rubber-band at
  the ends, plus tap zones on the left/right edges and keyboard arrows.
- `CompareCard` maps `ATTRIBUTE_ROWS` in fixed order. Em-dash for missing values.
- `PositionIndicator`: dots plus "2 of 3" text. Both, always visible.
- Dev-only alignment overlay toggled by `g`.
- Deck frozen at confirm time; `/compare` redirects to `/wishlist` if the deck has <2 items.
- Emit `comparison_started`, `card_swiped`, `comparison_exited`.

**Gate:** open a 4-card deck, screenshot cards 1 and 4, overlay them — every row boundary
lines up. Background the tab, return, deck and index are intact.

## Phase 6 — Size wedge (R4)

Load the `size-wedge` skill first.

- `getRecommendedSize` returning `null` with no brand signal → general size guide branch.
- `getStatus` from `/api/inventory`. Three states: available, low ("Only 2 left"), unavailable.
- The wedge shows the recommended size, the status, and the `basis` string that explains
  where the recommendation came from.
- `useInventory` polling hook, 8s, paused when the tab is hidden.
- Scripted stock simulator from `data/stock-events.json`: at 15s, one deck SKU goes out of
  stock in the recommended size. Wedge transitions in place; toast explains; Add to Bag
  disables with a stated reason. `stock_changed_in_session` fires.
- Unavailable items stay in the deck, fully readable. Never filtered, never reordered.
- Emit `size_wedge_viewed`, `size_wedge_tapped`.

**Gate:** all four R4 criteria demonstrable in one continuous session, including the
no-signal branch and the live change.

## Phase 7 — Review summaries (R5)

Load the `review-summarizer` skill first.

- Write and verify the fallback path **first**: with no `GEMINI_API_KEY`, every card renders a
  sensible summary from `summaries.fallback.json`.
- Then `/api/summarize`: batched POST for all deck SKUs, Gemini call per SKU, 6s timeout,
  strict JSON parsing, Zod validation, module-scope cache.
- Post-LLM validation enforcing RULES C2: mixed-sentiment corpus must yield a negative or
  mixed theme. One retry with a corrective instruction, then fallback.
- Below `REVIEW_THRESHOLD` (8): render "Not enough reviews yet", make no LLM call.
- Prefetch on selection confirm; skeleton in the reviews row, never a layout-shifting spinner.
- Emit `summary_rendered` with `source`, `themeCount`, `hasNegative`.

**Gate:** kill the API key → app still fully works. Restore it → summaries are LLM-generated,
p95 under 3s with a warm cache, and the two below-threshold SKUs show the honest empty state.

## Phase 8 — Card actions and PDP (R6)

- `CardActions` pinned within the card viewport: Add to Bag primary, always visible without
  scrolling. "See product" secondary. "Remove from wishlist" at the bottom, visually lighter.
- Add to Bag: in-place confirmation, bag count increments, **deck does not close or advance**.
  Disabled with a reason when the recommended size is unavailable.
- See product → `/product/[id]`; back returns to the same deck index.
- Remove: leaves both wishlist and deck immediately, indicator and length update in place,
  **no exit from comparison mode**. Dropping below 2 returns to `/wishlist` with a toast
  explaining why.
- Emit `add_to_bag`, `remove_from_wishlist`, `pdp_opened`.

**Gate:** every R6 criterion passes, especially the two that are easy to get wrong —
add-to-bag not exiting, and remove-to-one returning to the wishlist cleanly.

## Phase 9 — Test, document, deploy

Load the `ship-to-vercel` skill first.

- Playwright specs, one file per requirement, per `ACCEPTANCE.md`. All green headless.
- Delete `/kitchen-sink` and any dev overlays from the production build.
- Lighthouse mobile: performance ≥85, accessibility ≥95. Fix what you can cheaply.
- Write `README.md` and finalise `DECISIONS.md` per `CLAUDE.md` §9.
- Push to GitHub. Then the single human step: `npx vercel login`, prompt the operator, then
  `vercel --prod`, set `GEMINI_API_KEY`, redeploy.
- Smoke-test the live URL yourself on a mobile viewport before reporting done.

**Gate:** live URL, full flow completes, no console errors, summaries LLM-generated in prod.
