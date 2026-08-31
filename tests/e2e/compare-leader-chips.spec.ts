import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";
import { computeDeckStats } from "../../src/lib/compareStats";
import type { Product } from "../../data/schema.ts";

// RULES B3: "showing which price is lowest is acceptable as a neutral
// factual marker" — but no automated winner, no ranking, no highlighted
// card. These specs cover both the pure tie-break logic (computeDeckStats,
// no browser needed — the seed catalog has no exact price/rating ties to
// exercise that branch through the UI) and the real rendered chips against
// the live catalog.

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

test.describe("computeDeckStats — pure tie-break logic", () => {
  test("a strict min/max gets exactly one leader each", () => {
    const products = [
      product({ id: "a", price: 500, rating: 3.5 }),
      product({ id: "b", price: 800, rating: 4.0 }),
      product({ id: "c", price: 1200, rating: 4.5 }),
    ];
    const stats = computeDeckStats(products, {});
    expect(stats.leaderBySku.a).toEqual({ lowestPrice: true, highestRated: false });
    expect(stats.leaderBySku.b).toEqual({ lowestPrice: false, highestRated: false });
    expect(stats.leaderBySku.c).toEqual({ lowestPrice: false, highestRated: true });
    expect(stats.priceMin).toBe(500);
    expect(stats.priceMax).toBe(1200);
    expect(stats.ratingMin).toBe(3.5);
    expect(stats.ratingMax).toBe(4.5);
  });

  test("a tie at the extreme flags every tied card, not just one", () => {
    const products = [
      product({ id: "a", price: 500, rating: 4.0 }),
      product({ id: "b", price: 500, rating: 3.0 }),
      product({ id: "c", price: 900, rating: 3.5 }),
    ];
    const stats = computeDeckStats(products, {});
    expect(stats.leaderBySku.a.lowestPrice).toBe(true);
    expect(stats.leaderBySku.b.lowestPrice).toBe(true);
    expect(stats.leaderBySku.c.lowestPrice).toBe(false);
  });

  test("a deck-wide tie (every item shares the value) suppresses the chip entirely", () => {
    const products = [
      product({ id: "a", price: 700, rating: 4.0 }),
      product({ id: "b", price: 700, rating: 4.0 }),
    ];
    const stats = computeDeckStats(products, {});
    expect(stats.leaderBySku.a).toEqual({ lowestPrice: false, highestRated: false });
    expect(stats.leaderBySku.b).toEqual({ lowestPrice: false, highestRated: false });
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

test.describe("Leader chips — rendered against the real catalog", () => {
  // HERE&NOW Relaxed Fit (₹649, 3.6★), Roadster Slim Fit (₹899, 4.1★),
  // Van Heusen Slim Fit Wrinkle-Free (₹1,599, 4.0★) — distinct min/max on
  // two different cards, and one card with neither.
  test("lowest price and best rated land on the correct, distinct cards", async ({ page }) => {
    await buildShirtDeck(page, ["HERE&NOW Relaxed Fit Cotton Poplin Shirt", "Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);

    const cheapest = page.locator('[data-card-active="true"]');
    await expect(cheapest.getByText("Lowest price")).toBeVisible();
    await expect(cheapest.getByText("Best rated")).toHaveCount(0);

    await page.getByRole("button", { name: "Next item" }).click();
    const middle = page.locator('[data-card-active="true"]');
    await expect(middle.getByText("Best rated")).toBeVisible();
    await expect(middle.getByText("Lowest price")).toHaveCount(0);

    await page.getByRole("button", { name: "Next item" }).click();
    const last = page.locator('[data-card-active="true"]');
    await expect(last.getByText("Lowest price")).toHaveCount(0);
    await expect(last.getByText("Best rated")).toHaveCount(0);
  });

  // Scoped to the carousel specifically, not the whole page — the "Our
  // pick for you" card (DECISIONS.md D8, an explicit operator override of
  // this same rule) legitimately uses verdict-adjacent language in its own
  // clearly-labeled, separate section, so a page-wide sweep would flag an
  // approved feature rather than catch a real regression. This test's job
  // is the boundary B3's parenthetical actually draws: the per-row chips
  // stay neutral and factual.
  test("leader chips never use ranking/verdict language beyond the fact itself", async ({ page }) => {
    await buildShirtDeck(page, ["HERE&NOW Relaxed Fit Cotton Poplin Shirt", "Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);
    const carouselText = await page.getByTestId("compare-carousel").innerText();
    for (const banned of ["Recommended", "Top pick", "Winner", "Our pick"]) {
      expect(carouselText).not.toContain(banned);
    }
  });

  test("the header row (heart / chips / remove) never pushes the image out of alignment across cards", async ({
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
