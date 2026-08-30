import { test, expect } from "@playwright/test";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";

// Deterministic against the real seed catalog (data/inventory.json):
// Roadster -> recommended M, but shirt-roadster-001's M is seeded at 0
// units (unavailable). HERE&NOW -> recommended S, shirt-hereandnow-001's S
// has 6 units (available). Peter England -> recommended M, shirt-
// peterengland-001's M has 28 units (available). 2 of 3 signalled items are
// in the shopper's size — chosen deliberately over shirt-hereandnow-002 or
// pants-allensolly-001, both scripted stock-event targets (R4's own specs
// already own that timing; this suite stays deterministic without racing it).
async function buildKnownDeck(page: import("@playwright/test").Page) {
  await page.goto("/wishlist");
  await selectCategory(page, "Shirts");
  await tapCompare(page);
  for (const brandTitle of [
    "Roadster Slim Fit Cotton Casual Shirt",
    "HERE&NOW Relaxed Fit Cotton Poplin Shirt",
    "Peter England Regular Fit Office Formal Shirt",
  ]) {
    await page.locator(`button[aria-label^="Select ${brandTitle} "]`).click();
  }
  await confirmCompare(page);
}

test.describe("Comparison summary strip", () => {
  test("renders exactly once, above the deck — not once per card", async ({ page }) => {
    await buildKnownDeck(page);
    await expect(page.getByTestId("summary-strip")).toHaveCount(1);
    const stripBox = await page.getByTestId("summary-strip").boundingBox();
    const deckBox = await page.locator('[data-card-active="true"]').boundingBox();
    expect(stripBox).not.toBeNull();
    expect(deckBox).not.toBeNull();
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(deckBox!.y + 1);
  });

  test("shows the correct price and rating range for the selected set", async ({ page }) => {
    await buildKnownDeck(page);
    const strip = page.getByTestId("summary-strip");
    // Prices: Roadster ₹899, HERE&NOW ₹649, Peter England ₹999 -> range ₹649-₹999.
    await expect(strip).toContainText("₹649");
    await expect(strip).toContainText("₹999");
    // Ratings: 4.1, 3.6, 4.3 -> range 3.6-4.3.
    await expect(strip).toContainText("3.6");
    await expect(strip).toContainText("4.3");
  });

  test("shows 2/3 in your size for the known deck, once inventory resolves", async ({ page }) => {
    await buildKnownDeck(page);
    const strip = page.getByTestId("summary-strip");
    await expect(strip.getByText("2/3")).toBeVisible({ timeout: 10_000 });
  });

  test("content is stable across swipes (deck-wide, not per-card)", async ({ page }) => {
    await buildKnownDeck(page);
    const strip = page.getByTestId("summary-strip");
    await expect(strip.getByText("2/3")).toBeVisible({ timeout: 10_000 });
    const before = await strip.innerText();
    await page.getByRole("button", { name: "Next item" }).click();
    await page.getByRole("button", { name: "Next item" }).click();
    const after = await strip.innerText();
    expect(after).toBe(before);
  });

  test("the position indicator (N of M) is unaffected by the strip", async ({ page }) => {
    await buildKnownDeck(page);
    await expect(page.getByText("1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next item" }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
  });
});
