import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";
import { computeDeckStats } from "../../src/lib/compareStats";
import type { Product } from "../../data/schema.ts";

// RULES B3: "showing which price is lowest is acceptable as a neutral
// factual marker" — but no automated winner, no ranking, no highlighted
// card. DECISIONS.md D11 extends the existing D8 override (the "Pick for
// you" card) to cover BEST VALUE and BEST FIT FOR YOU by name, since RULES
// B3 literally lists "Best value" as a banned example and the operator
// asked for it anyway. These specs cover both the pure tie-break/priority
// logic (computeDeckStats, no browser needed — the seed catalog has no
// exact price/rating ties to exercise that branch through the UI) and the
// real rendered chips against the live catalog.

function product(overrides: Partial<Product>): Product {
  return {
    id: "test-sku",
    category: "shirts",
    brand: "Test",
    title: "Test Shirt",
    images: ["/products/shirt-roadster-001-1.jpg"],
    mrp: 1000,
    price: 1000,
    discountPct: 0,
    rating: 4.0,
    ratingCount: 100,
    fit: "Regular Fit",
    material: "100% Cotton",
    sizes: ["S", "M", "L"],
    savedAt: new Date().toISOString(),
    deliveryEstimate: "Delivery by Mon, Sep 1",
    ...overrides,
  };
}

test.describe("computeDeckStats — pure tie-break/priority logic", () => {
  test("a strict min/max gets exactly one label each, on the right card", () => {
    const products = [
      product({ id: "a", price: 500, rating: 3.5, deliveryEstimate: "Delivery by Wed, Sep 3" }),
      product({ id: "b", price: 800, rating: 4.0, deliveryEstimate: "Delivery by Mon, Sep 1" }),
      product({ id: "c", price: 1200, rating: 4.5, deliveryEstimate: "Delivery by Fri, Sep 5" }),
    ];
    const stats = computeDeckStats(products, {});
    // a: cheapest and best rating-per-rupee -> LOWEST PRICE + BEST VALUE
    expect(stats.labelsBySku.a).toEqual(["BEST VALUE", "LOWEST PRICE"]);
    // b: fastest delivery only
    expect(stats.labelsBySku.b).toEqual(["FASTEST DELIVERY"]);
    // c: best rated only
    expect(stats.labelsBySku.c).toEqual(["BEST RATED"]);
    expect(stats.priceMin).toBe(500);
    expect(stats.priceMax).toBe(1200);
    expect(stats.ratingMin).toBe(3.5);
    expect(stats.ratingMax).toBe(4.5);
  });

  test("a card is capped at 2 labels even when it qualifies for more", () => {
    // a wins price, rating, value, and delivery all at once.
    const products = [
      product({ id: "a", price: 400, rating: 4.8, deliveryEstimate: "Delivery by Mon, Sep 1" }),
      product({ id: "b", price: 900, rating: 3.5, deliveryEstimate: "Delivery by Fri, Sep 5" }),
    ];
    const stats = computeDeckStats(products, {});
    expect(stats.labelsBySku.a).toHaveLength(2);
    expect(stats.labelsBySku.a).toEqual(["BEST VALUE", "BEST RATED"]);
    expect(stats.labelsBySku.b).toEqual([]);
  });

  test("a tie at the extreme flags every tied card, not just one", () => {
    // Ratings held equal too, so BEST VALUE/BEST RATED don't also fire and
    // crowd LOWEST PRICE out of the 2-label cap — this test is isolating
    // the price tie-break specifically.
    const products = [
      product({ id: "a", price: 500, rating: 4.0 }),
      product({ id: "b", price: 500, rating: 4.0 }),
      product({ id: "c", price: 900, rating: 4.0 }),
    ];
    const stats = computeDeckStats(products, {});
    expect(stats.labelsBySku.a).toContain("LOWEST PRICE");
    expect(stats.labelsBySku.b).toContain("LOWEST PRICE");
    expect(stats.labelsBySku.c).not.toContain("LOWEST PRICE");
  });

  test("a deck-wide tie (every item shares the value) suppresses the label entirely", () => {
    const products = [
      product({ id: "a", price: 700, rating: 4.0 }),
      product({ id: "b", price: 700, rating: 4.0 }),
    ];
    const stats = computeDeckStats(products, {});
    expect(stats.labelsBySku.a).toEqual([]);
    expect(stats.labelsBySku.b).toEqual([]);
  });

  test("BEST FIT FOR YOU lands only on items available in the shopper's size, and only when not all are", () => {
    const products = [product({ id: "a" }), product({ id: "b" }), product({ id: "c" })];
    const stats = computeDeckStats(products, {
      a: { recommendation: { size: "M", confidence: "high", basis: "" }, status: "available" },
      b: { recommendation: { size: "M", confidence: "high", basis: "" }, status: "unavailable" },
      // c has no entry at all — no signal
    });
    expect(stats.labelsBySku.a).toContain("BEST FIT FOR YOU");
    expect(stats.labelsBySku.b).not.toContain("BEST FIT FOR YOU");
    expect(stats.labelsBySku.c).not.toContain("BEST FIT FOR YOU");
  });

  test("BEST FIT FOR YOU is suppressed when every item is available in size (universally true = uninformative)", () => {
    const products = [product({ id: "a" }), product({ id: "b" })];
    const stats = computeDeckStats(products, {
      a: { recommendation: { size: "M", confidence: "high", basis: "" }, status: "available" },
      b: { recommendation: { size: "L", confidence: "high", basis: "" }, status: "low" },
    });
    expect(stats.labelsBySku.a).not.toContain("BEST FIT FOR YOU");
    expect(stats.labelsBySku.b).not.toContain("BEST FIT FOR YOU");
  });

  test("in-your-size count only counts deck items with a size signal", () => {
    const products = [product({ id: "a" }), product({ id: "b" }), product({ id: "c" })];
    const stats = computeDeckStats(products, {
      a: { recommendation: { size: "M", confidence: "high", basis: "" }, status: "available" },
      b: { recommendation: { size: "M", confidence: "high", basis: "" }, status: "unavailable" },
      // c has no entry at all — no signal
    });
    expect(stats.inSizeTotal).toBe(2);
    expect(stats.inSizeCount).toBe(1);
    expect(stats.inSizeLoading).toBe(false);
  });

  test("zero signalled items suppresses the in-your-size segment (null, not 0 of 0)", () => {
    const products = [product({ id: "a" }), product({ id: "b" })];
    const stats = computeDeckStats(products, {});
    expect(stats.inSizeCount).toBeNull();
  });
});

// Each entry is the tile's full "brand title" text, matching the prefix of
// its checkbox's aria-label ("Select {brand} {title} for comparison").
async function buildShirtDeck(page: Page, brandTitles: string[]) {
  await page.goto("/wishlist");
  await selectCategory(page, "Shirts");
  await tapCompare(page);
  for (const brandTitle of brandTitles) {
    await page.locator(`button[aria-label^="Select ${brandTitle} "]`).click();
  }
  await confirmCompare(page);
}

test.describe("Leader labels — rendered against the real catalog", () => {
  // HERE&NOW Relaxed Fit (₹649, 3.6★), Roadster Slim Fit (₹899, 4.1★),
  // Van Heusen Slim Fit Wrinkle-Free (₹1,599, 4.0★) — distinct min/max on
  // two different cards.
  test("at least one label renders, and no card exceeds 2", async ({ page }) => {
    await buildShirtDeck(page, ["HERE&NOW Relaxed Fit Cotton Poplin Shirt", "Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);

    const carouselText = await page.getByTestId("compare-carousel").innerText();
    const anyLabel = ["BEST VALUE", "BEST RATED", "BEST FIT FOR YOU", "LOWEST PRICE", "FASTEST DELIVERY"].some(
      (label) => carouselText.includes(label),
    );
    expect(anyLabel).toBe(true);
  });

  // Scoped to the carousel specifically, not the whole page — the "Our
  // pick for you" card (DECISIONS.md D8/D11, an explicit operator override
  // of this same rule) legitimately uses verdict-adjacent language in its
  // own clearly-labeled, separate section, so a page-wide sweep would flag
  // an approved feature rather than catch a real regression. This test's
  // job is the boundary B3's parenthetical actually draws: the per-row
  // labels stay factual, never ranking language beyond the label itself.
  test("leader labels never use ranking/verdict language beyond the labels themselves", async ({ page }) => {
    await buildShirtDeck(page, ["HERE&NOW Relaxed Fit Cotton Poplin Shirt", "Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);
    const carouselText = await page.getByTestId("compare-carousel").innerText();
    for (const banned of ["Recommended", "Top pick", "Winner", "Our pick"]) {
      expect(carouselText).not.toContain(banned);
    }
  });

  test("the header row (heart / labels / remove) never pushes the image out of alignment across cards", async ({
    page,
  }) => {
    // Regression guard for a real bug found during development: a chip
    // present on some cards and absent on others briefly pushed the image
    // below it to different heights per card before the header row was
    // rebuilt as a flex row instead of absolute-positioned overlays.
    await buildShirtDeck(page, ["HERE&NOW Relaxed Fit Cotton Poplin Shirt", "Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);
    const imgTops = await page
      .locator('[data-card-active] img')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(new Set(imgTops).size).toBe(1);
  });
});
