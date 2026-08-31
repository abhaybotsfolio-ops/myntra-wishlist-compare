# ACCEPTANCE.md

Every acceptance criterion from the PRD, restated as a verifiable check. Each row is either
an automated Playwright assertion (`tests/e2e/rN-*.spec.ts`) or a manual check you perform in
a browser. Nothing here is optional. The build is not done until every row passes.

Write each spec **during** the phase that implements it, not at the end.

---

## R1 — Entry point · `tests/e2e/r1-entry.spec.ts`

| # | Check | Method |
|---|---|---|
| 1.1 | Compare button is present at the top of the wishlist when Shirts is active | auto |
| 1.2 | Compare button is present when Pants is active | auto |
| 1.3 | Compare button is disabled (or absent) on All Items, with a visible reason | auto |
| 1.4 | Tapping Compare enters selection mode with no URL change and no screen transition | auto — assert `page.url()` unchanged and the wishlist grid is still mounted |
| 1.5 | Compare is disabled when the active category has fewer than 2 saved items | auto |

## R2 — Selection · `tests/e2e/r2-selection.spec.ts`

| # | Check | Method |
|---|---|---|
| 2.1 | Selecting 2 items enables the sticky bar | auto |
| 2.2 | Sticky bar label reflects the live count ("Compare 3") | auto |
| 2.3 | Sticky bar is disabled at 0 and 1 selections | auto |
| 2.4 | A 5th selection attempt is refused **and** shows a message | auto — assert both the count stays at 4 and a toast is visible |
| 2.5 | Only current-category items are selectable; tabs are locked during selection | auto |
| 2.6 | Deselecting works and returns the count correctly | auto |
| 2.7 | Scroll position is preserved entering and exiting selection mode | auto — record `scrollY` before and after |

## R3 — Comparison deck · `tests/e2e/r3-deck.spec.ts`

**DECISIONS.md D8 note:** the compare screen was rebuilt around a compact swipeable carousel
plus a shared comparison table below it (operator-directed, matching a reference HTML
prototype), replacing the original full-height per-card attribute stack. 3.5/3.6 below are
updated to describe the mechanic that actually ships — a CSS grid table guarantees column
alignment natively, so there's no separate per-card pixel-alignment system to verify the way
there was; what's tested instead is that the table itself is structured correctly, and that the
carousel's own header row (icons + leader chips) can't push cards out of alignment with each
other, which is the real risk in this shape.

| # | Check | Method |
|---|---|---|
| 3.1 | Each selected item renders as its own carousel slide; deck length equals selection count | auto |
| 3.2 | Drag-swipe advances the deck | auto — `mouse.move` drag with velocity |
| 3.3 | Tap navigation advances the deck | auto |
| 3.4 | Position indicator shows both dots and "N of M", always visible | auto |
| 3.5 | The carousel's icon/leader-chip header row never pushes a card's image out of vertical alignment with its siblings | auto — asserts identical `getBoundingClientRect().top` for every slide's image, regardless of how many leader chips that card has |
| 3.6 | The At a glance table's rows are ordered Price, Rating, AI size, Delivery | auto |
| 3.7 | A no-signal item's size renders an em-dash in the table, never blank or a guessed size | auto |
| 3.8 | Deck and index survive backgrounding | auto — `page.evaluate` a visibilitychange, reload from sessionStorage, assert state |

## R4 — Size wedge · `tests/e2e/r4-size.spec.ts`

**DECISIONS.md D9 note:** the recommendation is now labelled "AI-recommended size" everywhere
it appears (`SizeLine`, the At a glance table's row label, the "Our pick for you" reasoning) —
operator feedback, a copy change only, the underlying logic (`getRecommendedSize`) is
unchanged. 4.7's toast ("Size X just went out of stock...") was also removed per operator
feedback — an unprompted alert on a session the user didn't initiate read as a confusing
interruption rather than a helpful cue; the in-place size-line/table update on its own still
demonstrates the live-update mechanic.

| # | Check | Method |
|---|---|---|
| 4.1 | Every card shows a recommended size **or** the general size guide — never blank | auto |
| 4.2 | Available / Unavailable status is shown for the recommended size | auto |
| 4.3 | The recommendation displays its basis ("You bought M in Roadster twice") | auto |
| 4.4 | A brand with no size signal renders the general size guide, not a guessed size | auto — assert the no-signal SKU shows the guide and no size badge |
| 4.5 | An item unavailable in the user's size **stays in the deck**, readable, not filtered | auto |
| 4.6 | Add to Bag is disabled with a stated reason when the recommended size is unavailable | auto |
| 4.7 | **Stock change mid-session updates the size line in place** | auto — advance clock past the 15s scripted event, assert the in-place status transition (no toast — see D9) |
| 4.8 | Polling pauses when the tab is hidden | manual — devtools network panel |

## R5 — Review summary · `tests/e2e/r5-reviews.spec.ts`

| # | Check | Method |
|---|---|---|
| 5.1 | Cards above threshold show 2–3 themes | auto |
| 5.2 | Themes cite review evidence (mentions count / "from N reviews") | auto |
| 5.3 | A mixed-sentiment SKU shows at least one negative or mixed theme | auto — assert on the known mixed SKU |
| 5.4 | Below-threshold SKUs read "Not enough reviews yet" | auto |
| 5.5 | No LLM request is made for a below-threshold SKU | auto — intercept `/api/summarize` and assert the SKU is absent from the payload |
| 5.6 | With `GEMINI_API_KEY` unset, every card still shows a summary and no error UI | auto — run the suite once with the key stripped |
| 5.7 | Summary row shows a skeleton, never a layout-shifting spinner | manual |
| 5.8 | p95 time-to-summary under 3s warm | manual — measure across 10 deck opens |

## R6 — Actions · `tests/e2e/r6-actions.spec.ts`

| # | Check | Method |
|---|---|---|
| 6.1 | Add to Bag is visible on every card without scrolling | auto — assert it is in the viewport on card mount for all N cards |
| 6.2 | Add to Bag increments the bag and shows in-place confirmation | auto |
| 6.3 | **Add to Bag does not exit or advance the deck** | auto — assert deck index and length unchanged |
| 6.4 | "See product" opens the PDP | auto |
| 6.5 | Returning from the PDP restores the same deck index | auto |
| 6.6 | Remove from wishlist is present at the bottom of every card | auto |
| 6.7 | Remove is styled as a secondary, lighter-weight action | manual — visual weight vs. Add to Bag |
| 6.8 | Removing drops the item from wishlist **and** deck immediately | auto |
| 6.9 | **Indicator and deck length update without exiting comparison mode** (4→3) | auto |
| 6.10 | Removing down to 1 item returns the user to the wishlist with an explanation | auto |
| 6.11 | The removed item is gone from the wishlist on return | auto |

## Cross-cutting

| # | Check | Method |
|---|---|---|
| X.1 | No coupon, discount nudge, notification, or urgency mechanic anywhere | manual — RULES B2 |
| X.2 | ~~No "winner", "best pick", or recommendation badge anywhere~~ — **superseded, DECISIONS.md D8**: the operator explicitly directed a "Pick for you" card overriding this rule. The leader chips (lowest price / best rated) remain within RULES B3's own parenthetical (a neutral, per-attribute factual marker) and are covered by `tests/e2e/compare-leader-chips.spec.ts`'s "never use ranking/verdict language" check, scoped to exclude the now-approved pick card. | manual — RULES B3, as amended by D8 |
| X.3 | No category other than Shirts and Pants appears in any surface | auto — grep the rendered DOM |
| X.4 | No `myntassets` or `myntra.com` string in the repo | auto — `grep -ri` in CI script |
| X.5 | App runs with zero env vars set | auto — build and run clean |
| X.6 | No console errors across the full flow | auto — collect `page.on('console')` |
| X.7 | All tap targets ≥44×44px | auto — Playwright bounding-box sweep |
| X.8 | Lighthouse mobile: performance ≥85, accessibility ≥95 | manual |
| X.9 | Full flow completes on a real phone at the live URL | manual — the final gate |
