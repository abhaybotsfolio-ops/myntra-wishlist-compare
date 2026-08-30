---
name: size-wedge
description: Implementing R4 — size recommendation, availability status, the no-signal size-guide branch, and the live in-session stock change. Load before writing lib/size.ts, /api/inventory, or the SizeWedge component.
---

# size-wedge

R4 is the differentiator. 84.6% of surveyed users hit size stockouts on wishlisted items and
30.8% respond by leaving for another app. Everything else in this feature is a well-executed
comparison view; this is the part that makes it worth building. Give it the most care.

Three concerns, deliberately separate. Collapsing them is the source of every bug in this area.

## 1. Recommendation

```ts
export function getRecommendedSize(
  profile: SizeProfile,
  brand: string,
): { size: string; confidence: 'high' | 'medium'; basis: string } | null
```

Looks up `profile.signals` by brand. **Returns `null` when there is no signal for that brand.**

Do not fall back to `defaultShirtSize`. Do not infer from a sibling brand. Do not return a
low-confidence guess. R4's third criterion is explicit — with no prior signal, show the
general size guide rather than a guess presented as a recommendation — and this is the single
easiest rule in the project to violate by accident, because a fallback feels helpful. It is
not: a confidently wrong size recommendation is how a user ends up with a return, which the
PRD's own guardrail metric penalises.

`basis` is rendered in the wedge. "You bought M in Roadster twice" is why a user trusts the
badge instead of ignoring it.

## 2. Availability

```ts
export function getStatus(
  inventory: Inventory,
  sku: string,
  size: string,
): 'available' | 'low' | 'unavailable'    // low: 1–2 units
```

Sourced from `/api/inventory`, never from the product record. Keeping stock in its own
endpoint is what makes the live-update criterion implementable at all — if availability were
baked into the catalog payload there would be nothing to update.

**Availability is assistive, never a filter (RULES B4).** An unavailable item stays in the
deck at the position the user put it, fully readable, with every other attribute intact. It
is not hidden, not moved to the end, not visually deprioritised beyond the wedge's own colour
state. Only Add to Bag disables, with a stated reason. The user chose to compare it; the
app's job is to inform, not to overrule.

## 3. Live update — the criterion nobody implements

"The availability status updates if stock changes while the user is still in the comparison
session." Two mechanisms together:

**Polling.** `useInventory(skus)` — 8s interval, `fetch('/api/inventory?skus=…')`, mounted
only on `/compare`, paused on `document.hidden`. Diff against previous state and animate only
the rows that changed.

**A scripted event.** Polling alone proves nothing in a demo, because nothing will change in
the two minutes a reviewer is looking. So `data/stock-events.json` holds deterministic events:

```json
[{ "atMs": 15000, "sku": "<resolved at session start>", "size": "<recommended>", "newUnits": 0,
   "condition": "sku_in_active_deck" }]
```

At `comparison_started`, resolve the event against the actual deck — pick a SKU the user
selected that is currently available in their recommended size. 15 seconds later the server's
inventory for that SKU/size drops to 0, the next poll picks it up, the wedge crossfades from
green to red over 240ms, a toast says something plain like "Size M just went out of stock for
the Roadster shirt", and Add to Bag disables with the reason inline.

Deterministic, not random. A demo behaviour that only sometimes fires is a demo behaviour
that will not fire in front of the reviewer. Seed a second event at 40s for longer sessions.

Fire `stock_changed_in_session` with `{sku, size, from, to}`.

## The component

76px, fixed height, between the price row and the review summary — `docs/PRD.md` §8 identifies
that position as the point of the information architecture, so do not move it for visual
balance.

Four variants, all the same height:

| State | Line 1 | Line 2 |
|---|---|---|
| available | `Your size: M · In stock` | basis string |
| low | `Your size: M · Only 2 left` | basis string |
| unavailable | `Your size: M · Out of stock` | basis string |
| no signal | `Size guide` + chevron | `We don't have your size history for this brand` |

Tinting per `myntra-ui`. The no-signal variant opens a sheet with the brand's general size
chart — a real chart with chest/waist measurements, not a placeholder. It is a fifth of the
cards a reviewer will see and it is where they check whether you took the "don't guess" rule
seriously.

Tapping the wedge in any state fires `size_wedge_tapped`; the PRD tracks wedge click-through
as a supporting metric, so the whole block is a tap target, not just the chevron.

## Performance

The PRD's §9 open question asks whether the size service can answer fast enough not to slow
the swipe. In this MVP the lookup is local and sub-millisecond, so the honest answer in
`README.md` is: this MVP does not test that constraint, and in production the recommendation
should be resolved for the whole comparison set in one batched call at deck open, not per
card at swipe time. Design the interface that way — `getRecommendedSize` takes one brand, but
the deck resolves all of them up front and caches, so swapping in a network call later is a
one-function change.
