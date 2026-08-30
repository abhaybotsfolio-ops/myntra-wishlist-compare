---
name: catalog-seed
description: How to generate the product catalog, synthetic review corpora, inventory, size profile and product imagery for the Myntra Comparison MVP — legally and with the data shape the acceptance tests require. Load before writing anything into /data or /public/products.
---

# catalog-seed

The seed data is not filler. It is the thing that makes every acceptance criterion
demonstrable. Generated carelessly — sixteen 4.2-star products with glowing reviews and full
stock — and half the feature has nothing to show. Every branch in the PRD needs a SKU that
exercises it.

## Hard sourcing rules

- **Never fetch from myntra.com or any Myntra subdomain.** Not for data, not for images.
- **Never reference `assets.myntassets.com`.** It blocks cross-origin referers; the deployed
  demo will show broken images within days, in front of a reviewer.
- Real brand *names* are fine as factual text: Roadster, HERE&NOW, Levi's, U.S. Polo Assn.,
  Van Heusen, Allen Solly, WROGN, Highlander, Peter England. No logo artwork — style the name
  as type.
- All review text is written by you. Never copy real reviews from anywhere.

## Images

Download apparel photography from Unsplash or Pexels into `/public/products/` and commit it.
Two images per SKU, 3:4, resized to 800×1067 and compressed to under 120KB each.

```bash
# via the Unsplash/Pexels API or direct photo URLs already in hand
curl -sL "<photo-url>" -o public/products/shirt-roadster-001-1.jpg
```

Prefer flat-lay or on-model apparel shots on plain backgrounds — they read as catalog
photography. Avoid busy lifestyle scenes; they look like a mood board, not a store.

If the network is unavailable, generate deterministic SVG placeholders: a soft fabric-toned
background, the brand name in the UI type, and the garment type below. Ugly is acceptable;
broken is not. Record the fallback in `DECISIONS.md`.

Write `public/products/CREDITS.md` with photographer and source URL per image.

## Catalog shape

16 SKUs — 9 shirts, 7 pants. Deliberately spread so the comparison rows do work:

- **Price** ₹499–₹3,499. At least one pair within ₹150 of each other so the price row poses a
  real trade-off, and at least one 3–4× gap so the "is it worth the extra" question is live.
- **Rating** 3.4–4.6. Nothing clustered. A deck where every rating is 4.2 makes the row dead
  weight.
- **Fit** Slim / Regular / Relaxed / Tapered, mixed within each category so the row differs
  card to card.
- **Material** genuinely varied — 100% Cotton, Cotton Blend, Linen Blend, Poly-Viscose,
  Stretch Denim. This is the row that resolves the 46.2% fabric-doubt blocker.
- **Sizes** shirts S–XXL, pants 28–38.

Discount percentages should look like Myntra's: mostly 40–65%, a couple at 20%, one at 0.

## Review corpora — the part that matters most

Volume bands from `docs/DATA_MODEL.md`, restated because they drive R5's acceptance tests:

| Band | SKUs | Count | Purpose |
|---|---|---|---|
| Rich positive | 6 | 30–60 | normal case |
| Rich mixed (≥30% at 1–3★) | 5 | 25–50 | forces a negative theme (RULES C2) |
| Thin | 3 | 8–14 | just above threshold |
| Below threshold | 2 | 2–5 | must render "Not enough reviews yet" |

Write reviews that a summariser can extract *comparable specifics* from. The test is whether
two products' summaries would differ in a way that helps someone choose.

Good: "Fabric felt stiff out of the packet but softened a lot after two washes." · "Sleeves
were about an inch longer than my usual M in this brand." · "Colour is noticeably more olive
than the photos suggest." · "Waist runs small — I sized up to 34 and it's right."

Bad: "Nice product." · "Value for money." · "Good quality, happy with purchase." A corpus of
these produces summaries that say nothing, and R5 exists precisely to say something.

Cluster themes intentionally. If you want a summary to surface "runs small in the waist",
write that observation into 8–12 reviews of that SKU with varied phrasing, so `mentions`
counts are real rather than invented.

Give the mixed-band SKUs genuine, specific criticism — colour mismatch, pilling after a few
washes, thin fabric, inconsistent sizing. If your "mixed" reviews are all mild praise with a
shrug, the negative-theme test in `ACCEPTANCE.md` 5.3 will fail and you will be tempted to
weaken the rule instead of fixing the data.

## Inventory

`inventory.json` maps sku → size → units. Seed so that:

- Most sizes are comfortably in stock.
- At least three SKU/size pairs sit at 1–2 units, to exercise the "Only 2 left" state.
- **At least two SKUs are already out of stock in the user's recommended size**, so R4's
  unavailable branch is visible immediately without waiting for the scripted event.

## Size profile

`signals` covers most brands with a `basis` string a human would find convincing — "You
bought M in Roadster twice", "You returned L in Levi's as too loose". `source` should vary
across `past_purchase`, `past_return`, `stated_preference`.

**Leave at least two brands out of `signals` entirely**, and make sure at least one of them is
a shirt brand and one a pants brand. Those SKUs render the general size guide. Do not let
`defaultShirtSize` leak in as a fallback recommendation — that is exactly the "guess presented
as a recommendation" the PRD forbids, and it is the easiest rule in this project to break by
accident.

## Fallback summaries

Hand-write a `Summary` for every above-threshold SKU into `summaries.fallback.json`, matching
the Zod schema exactly. Write these while the review corpora are fresh in mind — they are the
app's reliability floor (RULES D1/D3), and if you leave them until after the LLM works you
will write them carelessly and the no-key demo will look worse than the demo with a key.

## Validation

`npm run validate:data` Zod-parses every file and additionally asserts the invariants above:
band counts, at least two unsignalled brands, at least two SKUs unavailable in the
recommended size, price spread, rating spread. Exit non-zero on any failure. These invariants
are what the acceptance tests depend on; a script that only checks types will let the data
drift out from under the tests.
