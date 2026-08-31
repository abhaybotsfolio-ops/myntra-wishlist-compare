# CLAUDE.md — Myntra Wishlist Comparison MVP

@AGENTS.md

You are building and deploying a production MVP from scratch, autonomously. The human
operator has asked for **minimum intervention**. There is exactly one step you cannot do
for them (Vercel authentication, see §8). Everything else — scaffolding, data, UI, API,
tests, deploy — is yours.

Read this file fully before writing any code. Then read `docs/PRD.md`,
`docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `RULES.md`. Work the phases in
`docs/BUILD_PLAN.md` in order. Verify against `docs/ACCEPTANCE.md` before you declare done.

---

## 1. What you are building

An interactive, deployed, mobile-first web prototype of a **wishlist comparison feature for
Myntra**. A shopper opens their wishlist, filters to a category (Shirts or Pants), taps
Compare, selects 2–4 saved items, and swipes through a side-by-side card deck showing price,
rating, fit, material, **whether the item is available in their size**, and an AI-generated
summary of what real buyers said. From any card they can add to bag, open the full product
page, or remove the item from their wishlist.

The full requirements are in `docs/PRD.md` as R1–R6. **All six are in scope.** R1–R4 are
Must, R5–R6 are Should — but this is a case-study MVP whose purpose is to be demoed, and a
comparison screen without review summaries or an Add to Bag button does not demo. Build all six.

## 2. What you are NOT building

- No PM analytics dashboard, no survey-data visualisation, no funnel charts. The operator
  explicitly scoped this to the shopper-facing feature only.
- No Maya conversational layer (PRD §10 future work).
- No categories beyond Shirts and Pants.
- No login, no auth, no real payments, no real checkout.
- No notifications, coupons, or discount nudges anywhere (PRD §4 non-goal — respect it).
- No automated "winner" or "best pick" badge. The feature presents evidence; the user decides.
  This is a hard product constraint, not a nice-to-have.

## 3. Stack (decided — do not substitute)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Vercel-native, one-command deploy |
| Styling | Tailwind CSS v4 | Speed, and the design tokens in the myntra-ui skill are written for it |
| Animation / swipe | `framer-motion` | Drag-to-swipe with velocity + snap, no custom gesture math |
| State | Zustand with `persist` middleware (sessionStorage) | Satisfies R3's session-persistence criterion for free |
| Icons | `lucide-react` | |
| LLM | Google Gemini (`gemini-3.6-flash`) via a Next.js Route Handler, called with plain `fetch` (no SDK) | Free tier, fast enough for a swipe interaction — **operator-directed substitution for the spec's original Groq choice; model name updated after Google retired gemini-2.0-flash; see DECISIONS.md** |
| Images | `next/image` over locally committed files in `/public/products` | No CDN rot, no hotlinking |
| Deploy | Vercel | Matches the reference MVP |
| Package manager | `npm` | |

Node 20+. No database — all state is seed JSON plus in-memory/session state. Adding a
database is scope creep and will make deployment fail.

## 4. Reference MVP — what to take and what to ignore

The operator pointed at `https://blinkit-discovery-engine-chi.vercel.app/` as a quality bar.
That app is a *research* artifact: scraped reviews, AI-classified into themed buckets with
counts, plus a grounded Q&A box, all on one dense scrollable page.

**Take from it:** the finish level (nothing looks like an unstyled prototype), the
brand-anchored visual identity, the fact that an LLM does real work in the product rather
than being decoration, one-URL deploy with zero setup for the viewer, and the confidence to
show real numbers rather than lorem ipsum.

**Ignore its shape entirely.** That is a dashboard you read. This is a feature you *use*.
The core of your build is an interaction, not an information display. If your output can be
fully understood from a screenshot, you have built the wrong thing.

## 5. Hard rules

These are non-negotiable. `RULES.md` has the complete list; these are the ones most likely
to be violated under time pressure:

1. **Never scrape myntra.com and never hotlink `assets.myntassets.com`.** Product imagery
   comes from Unsplash/Pexels, downloaded and committed. See the catalog-seed skill.
2. **The app must never render a broken or empty state to a demo viewer.** Every network
   call has a fallback. Every image has a fallback. If Gemini is down or the key is missing,
   precomputed summaries render and nothing in the UI announces a failure.
3. **Review summaries must be able to say something negative.** If the source reviews
   contain material criticism, at least one theme must reflect it. An all-positive summary
   on a product with mixed reviews is a correctness bug, not a tone preference.
4. **Never fabricate a review summary for a low-volume SKU.** Under the threshold, the
   section reads "Not enough reviews yet". Do not call the LLM at all in that case.
5. **Never fabricate a size recommendation.** No brand signal means show the general size
   guide, not a guess dressed up as a recommendation.
6. **Attribute rows must align pixel-for-pixel across every card.** This is the entire
   mechanic of R3. If price sits at a different y-position on card 2 than card 1, the
   feature does not work. Enforce with a fixed row order and fixed min-heights.
7. **Removing an item must not exit comparison mode** unless it would leave fewer than 2 items.
8. **Adding to bag must not exit the comparison view.**
9. **No API keys in the repo.** `.env.local` is gitignored; `.env.example` is committed.
10. **Ship mobile-first.** Design at 390×844. Desktop renders the same app inside a centred
    phone frame — do not build a separate responsive desktop layout.

## 6. Working method

- Commit after every phase in `docs/BUILD_PLAN.md`, with a message naming the phase.
- Run `npx tsc --noEmit` and `npm run build` before every commit. A phase is not complete
  if the build is broken.
- Write the Playwright acceptance specs in `docs/ACCEPTANCE.md` as you build each
  requirement, not at the end.
- When a PRD acceptance criterion is ambiguous, choose the interpretation that makes the
  feature more honest to the user, and record the decision in `DECISIONS.md` at the repo
  root. Do not stop to ask.
- Do not add features that are not in the PRD. A case-study reviewer will check the build
  against the spec; unrequested extras read as scope indiscipline, not generosity.

## 7. Skills

Load the relevant skill before starting the corresponding work. Each is at
`.claude/skills/<name>/SKILL.md`:

| Skill | Load it before |
|---|---|
| `myntra-ui` | writing any component or CSS |
| `catalog-seed` | generating products, reviews, inventory, or sourcing images |
| `review-summarizer` | building the `/api/summarize` route or its prompt |
| `size-wedge` | building recommendation, availability, or the live stock simulator |
| `ship-to-vercel` | deployment, env vars, or build configuration |

## 8. The one human step

You cannot authenticate to Vercel on the operator's behalf, and you must not attempt to
create an account for them. When you reach the deploy phase:

1. Get the app fully green locally and pushed to a GitHub repo.
2. Run `npx vercel login` and stop. Print a short, exact instruction block telling the
   operator to complete the browser login, and telling them to paste their Gemini API key
   when you prompt for it (free key from `aistudio.google.com/apikey`).
3. Once they confirm, run `npx vercel --prod`, set `GEMINI_API_KEY` as a production
   environment variable, redeploy, then fetch the live URL and smoke-test it yourself.

Ask for nothing else. If you find yourself wanting to ask a product question, re-read §6.

## 9. Definition of done

- Live Vercel URL, loads on a phone, no console errors.
- Every acceptance criterion in `docs/ACCEPTANCE.md` passes, verified by Playwright where
  automatable and by your own browsing where not.
- `README.md` at repo root: what it is, the live URL, local setup in three commands, a
  requirement-by-requirement map of where each PRD criterion is implemented, and a short
  honest list of what is mocked (inventory, size intelligence, catalog) versus real (the
  interaction, the LLM summarisation).
- `DECISIONS.md` listing every judgement call you made where the PRD was silent.
- The operator can hand the URL to a reviewer with no explanation and the reviewer can
  complete the full flow unaided.
