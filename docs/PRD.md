# Wishlist Comparison with Size-Aware Availability — PRD

> Source: `Myntra_Wishlist_Comparison_PRD.docx`, v1.0, 28 August 2026.
> Owner: Wishlist & Discovery PM. Status: Draft for review.
> This is the authoritative product spec. Where this file and any other doc in this repo
> disagree about *what* to build, this file wins. Other docs govern *how*.

## 1. Background

Tapping a wishlisted item currently returns the user to the full product page — the same
page, the same recommendations, the same information they already read once. A user with
three or four saved shirts ends up bouncing between PDPs, holding prices, ratings and fit
notes in their head across separate screens. Nothing in today's wishlist is built for the
moment when someone already knows roughly what they want and is just trying to pick one.

This proposes a comparison mode inside the wishlist: select 2–4 saved items in the same
category, see them side by side with the handful of facts that actually help someone decide,
plus a size availability check so nobody spends time comparing something they cannot buy.

## 2. Why this matters

Survey of 28 shoppers, 26 with an active wishlist.

- **Comparison is already the dominant reason people save multiple items.** 17/26 (65.4%)
  said at least 3 of their last 10 saves were specifically to compare before deciding.
  15/26 (57.7%) said the same for items they genuinely intend to buy later. This is an
  existing behaviour done manually and badly across separate pages.
- **Top blockers to purchase:** quality/fabric doubt (46.2%), price hesitation (42.3%),
  changed mind (42.3%). A comparison view with real review evidence and price-next-to-price
  addresses the first two. It does not fix changed-mind decay — called out in §9.
- **Stock is its own signal.** 22/26 (84.6%) said a wishlisted item goes out of stock in
  their size sometimes or often. Average frustration 3.5/5. 30.8% said their next step is to
  check another app entirely. Putting products side by side without showing size
  availability produces a comparison that wastes the user's time.

## 3. Goals

- Faster choosing between saved items without repeatedly opening full product pages.
- Surface the evidence that resolves quality and fit doubt at the moment of decision, not
  three taps away.
- Prevent users comparing and choosing an item they cannot get in their size.
- Move incremental wishlist-to-purchase conversion for Shirts and Pants without discounts.

## 4. Non-goals for this release

- No notifications, coupons, or discount nudges anywhere in this feature.
- No categories beyond Shirts and Pants at launch.
- No automated "winner" selection — the feature presents evidence, the user decides.
- No changes to how items are added to the wishlist, or to Collections.

## 5. Requirements and acceptance criteria

### R1 — Entering comparison mode from the wishlist · **Must**

*As a shopper with several saved items, I want a clear way to start comparing them so I
don't have to open each product page one by one.*

- A "Compare" button appears at the top of the wishlist when viewing a single category
  (Shirts or Pants).
- The button is hidden or disabled on the combined "All Items" view, since items across
  categories aren't comparable.
- Tapping Compare puts the wishlist into selection mode without leaving the wishlist screen.

### R2 — Selecting 2 to 4 items · **Must**

*As a shopper, I want to choose exactly which saved items to compare, so the comparison
stays focused on the options I actually care about right now.*

- Minimum 2, maximum 4. A 5th selection attempt shows a brief message rather than being
  silently ignored.
- Only items in the current category can be selected in the same session.
- A sticky bottom button reflects the live count ("Compare 3") and is disabled below 2.
- Users can deselect before confirming without losing their place in the wishlist.

### R3 — Swiping through the comparison · **Must**

*As a shopper, I want to flip between my selected items and see the same information in the
same place each time, so I can spot differences quickly instead of hunting for them.*

- Each selected item is its own card; users move between cards by left/right swipe or tap.
- Attribute rows (price, rating, fit, material, size availability, review summary) appear in
  the same vertical position on every card.
- A position indicator (dots or "1 of 3") is visible at all times.
- The comparison set persists if the user backgrounds the app and returns in the same session.

### R4 — Size-aware availability (the size wedge) · **Must**

*As a shopper, I want to see straight away whether an item is available in my size, so I
don't waste time comparing something I can't buy.*

- Each card shows the user's recommended size (from existing size/fit intelligence) and a
  clear Available / Unavailable status for that size.
- Availability is assistive, not a hard filter — an unavailable item stays in the comparison
  if the user chose to include it.
- With no prior size signal for that brand, the card shows the general size guide rather
  than a guess presented as a recommendation.
- Availability status updates if stock changes while the user is still in the session.

### R5 — Review summary in place of full reviews · **Should**

*As a shopper, I want a short, honest summary of what other buyers actually experienced,
without reading dozens of reviews for every item I'm comparing.*

- Each card shows 2–3 short review themes drawn from actual customer reviews for that product.
- If a material number of reviews mention a downside, at least one negative or mixed theme is
  shown — the summary cannot be all-positive by default.
- Summaries appear only when review volume supports them; below that threshold the section
  reads "Not enough reviews yet" rather than fabricating a summary.

### R6 — Acting without leaving the comparison · **Should**

*As a shopper who has made up my mind, I want to add the item to my bag — or take it off my
wishlist if I've decided against it — right from the comparison screen.*

- "Add to Bag" is visible on every card without scrolling.
- A secondary "See product" action opens the full PDP.
- "Remove from wishlist" is available at the bottom of every card, styled as a
  lighter-weight secondary action so it isn't confused with Add to Bag.
- Removing takes the item out of the wishlist and the comparison set immediately; the
  position indicator and swipe count update, without exiting comparison mode.
- If removing would drop the set below 2 items, return the user to the wishlist rather than
  leaving a broken single-item comparison.
- Adding to bag does not exit the comparison view.

## 6. Relative prioritization (MoSCoW)

| Requirement | Priority | Why |
|---|---|---|
| R2 — 2–4 selection, same category | **Must** | Without a bounded, same-category set the feature collapses back into the overwhelm it fixes |
| R3 — fixed attribute layout, swipe | **Must** | The core mechanic; without it there is no comparison, just a list |
| R4 — size availability wedge | **Must** | 84.6% hit size stockouts, 30.8% leave for another app |
| R1 — Compare entry point | **Must** | Users need a way in; smallest possible surface |
| R5 — review summary with honest downside | **Should** | Strong support from quality/fabric data (46.2%) but usable without for a first release |
| R6 — Add to Bag / Remove / See product | **Should** | Both need to work for the screen to feel complete, but a temporary PDP redirect wouldn't block launch |
| Cross-category comparison | Could | Not supported by current evidence, adds real attribute-layout complexity |
| Maya conversational layer | Could | Sequenced deliberately after Comparison proves the core workflow |

**Build note for this MVP:** all of R1–R6 are in scope. The Shoulds are what make the
prototype demoable. The Coulds are explicitly out.

## 7. Success metrics

**Primary:** incremental wishlist-to-purchase conversion among eligible Shirts and Pants
wishlist users, measured against a holdout.

**Supporting:** comparison initiation rate (Compare taps / eligible wishlist sessions);
comparison completion (sessions with 2+ items selected and ≥1 swipe); Compare → Add-to-Bag →
Purchase funnel; size wedge click-through and its effect on Compare → Add-to-Bag;
decision-efficiency proxy (time and steps from Compare to selection vs. a non-Compare control);
leakage proxy (comparison-intent sessions exiting without a PDP or Add-to-Bag, vs. control).

**Guardrail:** return and cancellation rate on purchases originating from Compare —
conversion is not a win if it comes from worse product matches.

## 8. User flow

Wishlist → select → compare → decide. Nothing in the middle asks the user to leave the
wishlist or make an unrelated decision. Each card carries a lightweight Remove from wishlist
action so someone who realises mid-comparison that an option no longer interests them can
drop it on the spot.

Three screens: (1) wishlist, category view; (2) selection mode; (3) compare, with size wedge.

Wireframes are intentionally low-fidelity — the point is information architecture and the
position of the size wedge relative to price and reviews.

## 9. Risks and open questions

- Changed-mind decay (42.3% of blockers) is not addressed here. Needs a separate
  re-engagement mechanism.
- Small survey (n=28, 26 active). Directionally useful; treat exact percentages as
  approximate.
- Review summaries depend on review volume per SKU. Newer items will show "not enough
  reviews yet" more often than we'd like.
- Need to confirm the size/fit recommendation service can answer fast enough not to slow the
  swipe interaction.

## 10. What comes next

A conversational layer (Maya) for questions a side-by-side view can't answer — "is the fabric
worth the extra 300 rupees", "which of these fits me better". Longer term, an intent model
distinguishing comparing / waiting on price / doubting quality / blocked by stock. Both
depend on this version proving the workflow.
