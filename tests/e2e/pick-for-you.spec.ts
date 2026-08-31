import { test, expect } from "@playwright/test";
import { computePickForYou } from "../../src/lib/pickForYou";
import type { Product } from "../../data/schema.ts";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";

// D8: an explicit, operator-directed override of RULES B3 ("no automated
// winner"). Pure logic tests first (no browser needed), then a check that
// the card actually renders against the real catalog with real reasoning.

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

test.describe("computePickForYou — pure logic", () => {
  test("prefers items available in the shopper's size over the highest-rated unavailable one", async () => {
    const products = [
      product({ id: "a", rating: 4.9, price: 2000 }),
      product({ id: "b", rating: 4.2, price: 1000 }),
    ];
    const sizeInfo = {
      a: { recommendation: { size: "M", confidence: "high" as const, basis: "" }, status: "unavailable" as const },
      b: { recommendation: { size: "M", confidence: "high" as const, basis: "" }, status: "available" as const },
    };
    const pick = computePickForYou(products, sizeInfo);
    expect(pick?.productId).toBe("b");
    expect(pick?.reasons.some((r) => r.includes("in stock"))).toBe(true);
  });

  test("falls back to the full set, rating then price, when nothing is available in size", async () => {
    const products = [
      product({ id: "a", rating: 4.0, price: 900 }),
      product({ id: "b", rating: 4.0, price: 700 }),
      product({ id: "c", rating: 3.5, price: 500 }),
    ];
    const pick = computePickForYou(products, {}); // no signals at all
    expect(pick?.productId).toBe("b"); // tied rating, lower price wins
  });

  test("cites a real price delta against a real, more expensive item in the set", async () => {
    const products = [
      product({ id: "a", rating: 4.5, price: 500, brand: "Cheap" }),
      product({ id: "b", rating: 4.0, price: 900, brand: "Pricier" }),
    ];
    const pick = computePickForYou(products, {});
    expect(pick?.productId).toBe("a");
    expect(pick?.reasons.some((r) => r.includes("₹400 cheaper than the Pricier"))).toBe(true);
  });

  test("returns null for fewer than 2 products", () => {
    expect(computePickForYou([product({ id: "a" })], {})).toBeNull();
    expect(computePickForYou([], {})).toBeNull();
  });
});

test.describe("Pick for you card — rendered against the real catalog", () => {
  test("shows a real product and a reasoning sentence built from real deck data", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Shirts");
    await tapCompare(page);
    for (const brandTitle of ["HERE&NOW Relaxed Fit Cotton Poplin Shirt", "Roadster Slim Fit Cotton Casual Shirt"]) {
      await page.locator(`button[aria-label^="Select ${brandTitle} "]`).click();
    }
    await confirmCompare(page);

    const pickCard = page.getByText("Our pick for you").locator("xpath=..");
    await expect(pickCard).toBeVisible();
    // Roadster is higher-rated (4.1 vs 3.6) and Roadster -> M is seeded
    // out of stock, so HERE&NOW (available, next-best rating) should win.
    await expect(pickCard).toContainText("HERE&NOW");
    await expect(pickCard).toContainText(/rated \d\.\d★/);
  });
});
