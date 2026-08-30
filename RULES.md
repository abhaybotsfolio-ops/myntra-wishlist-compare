# RULES.md

Constraints that hold for the entire build. When a rule here conflicts with something you
inferred from a doc, an example, or your own instinct, this file wins. When two rules here
conflict, the more restrictive one wins.

---

## A. Legal and data sourcing

**A1.** Do not scrape, crawl, or programmatically fetch from `myntra.com` or any Myntra
subdomain. Not for products, not for images, not for reviews, not "just to check a price".

**A2.** Do not hotlink `assets.myntassets.com` or any Myntra CDN host. It blocks
cross-origin referers and the deployed demo will degrade to broken images.

**A3.** Product imagery comes from Unsplash or Pexels, downloaded at seed time and committed
to `/public/products/`. Attribution lives in `public/products/CREDITS.md`.

**A4.** Real brand names (Roadster, HERE&NOW, Levi's, U.S. Polo Assn., Van Heusen, Allen
Solly, WROGN, Highlander) are fine — they are factual references in a UI mock. Do not
reproduce any brand's logo artwork; render brand names as styled text.

**A5.** All reviews in the seed corpus are synthetic and written for this project. Do not
copy real review text from any site. `README.md` must state that reviews are synthetic.

**A6.** No Myntra logo file. Render the wordmark as styled type using the tokens in the
`myntra-ui` skill.

## B. Product constraints from the PRD

**B1.** Shirts and Pants only. No other category appears anywhere in the UI, including in
filter chips.

**B2.** No notifications, coupon codes, discount nudges, urgency timers, or "only 3 people
viewing" pressure mechanics. PRD §4 rules these out and a reviewer will notice.

**B3.** No automated winner. No "Best value", no "Recommended", no highlighted card, no
star-ranking across the set, no sorting that implies a verdict. Attribute values may be
visually compared (e.g. showing which price is lowest is acceptable as a neutral factual
marker) but the app must never tell the user which item to pick.

**B4.** Size availability is assistive, never a filter. An item unavailable in the user's
size stays in the comparison if the user selected it, fully readable, with Add to Bag
disabled and a clear reason.

**B5.** The comparison set is capped at 4 and floored at 2. A 5th selection attempt produces
a visible, non-blocking message — never a silent no-op.

**B6.** Items from different categories can never enter the same comparison set.

## C. Honesty constraints

**C1.** If a SKU has fewer than `REVIEW_THRESHOLD` (8) reviews, the review section renders
"Not enough reviews yet". No LLM call is made. No summary is invented.

**C2.** If the review corpus for a SKU contains material negative sentiment (≥20% of reviews
rated 3 or below), the rendered summary must include at least one negative or mixed theme.
Enforce this in code after the LLM returns, not only in the prompt — if the model returns
three positive themes for a mixed-sentiment product, reject and retry once, then fall back
to the precomputed summary.

**C3.** If there is no size signal for the user for a given brand, show the general size
guide. Do not display a recommended size with fabricated confidence.

**C4.** Anything mocked must be listed as mocked in `README.md`. Do not imply the demo is
wired to live Myntra inventory.

## D. Reliability constraints

**D1.** Every LLM call has a timeout (6s) and a fallback to a precomputed summary stored in
the seed data. The user-facing UI never shows an error state for a failed summarisation —
it shows the fallback, silently. Log the failure server-side only.

**D2.** Every `next/image` has a local fallback. No layout shift when an image is slow.

**D3.** The app must run with zero environment variables set. Missing `GEMINI_API_KEY` degrades
to precomputed summaries; it does not crash the build or the runtime.

**D4.** No database, no external store, no auth provider, no analytics SDK. Every added
dependency is a deployment failure mode.

## E. Interaction constraints

**E1.** Fixed attribute row order on every card, always, in this order: image, brand + title,
price block, rating, **size availability**, fit, material, review summary, actions. The size
wedge sits directly between price and the review summary — PRD §8 calls this out as the point
of the information architecture.

**E2.** Every attribute row has a fixed `min-height` so rows align across cards even when
content lengths differ. Missing data renders an em-dash placeholder, never a collapsed row.

**E3.** Add to Bag is reachable on every card without scrolling. Pin the action bar to the
bottom of the card viewport.

**E4.** Remove from wishlist is styled as a lighter-weight secondary action, visually
subordinate to Add to Bag, and placed at the bottom of the card.

**E5.** Add to Bag does not navigate away, does not close the deck, does not advance the card.

**E6.** Removing an item updates the position indicator and deck length in place. Dropping
below 2 items returns the user to the wishlist with a brief explanation.

**E7.** Target 390×844. Every tap target ≥44×44px. The deck must be swipeable by drag and
navigable by tap, and must work with a trackpad on desktop.

## F. Engineering constraints

**F1.** TypeScript strict. No `any`. No `@ts-ignore`.

**F2.** `npx tsc --noEmit` and `npm run build` both clean before every commit.

**F3.** No secrets in the repo. `.env.local` gitignored, `.env.example` committed.

**F4.** All seed data validated with Zod at load time. Malformed seed data fails loudly in
development and falls back to a known-good subset in production.

**F5.** Do not add a state management layer beyond Zustand, do not add a component library,
do not add a CSS-in-JS runtime.

**F6.** Analytics events are emitted through a single `track()` function that writes to a
session-scoped in-memory ring buffer and `console.debug`. No third-party SDK. The event names
in `docs/ARCHITECTURE.md` §7 are fixed — a reviewer may ask how the PRD's success metrics
would be measured, and the event names are the answer.
