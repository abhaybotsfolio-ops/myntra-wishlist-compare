import { test, expect } from "@playwright/test";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";

// D8: replaces the old range-summary strip (SummaryStrip) with the
// reference prototype's "At a glance" table — real per-item values in a
// CSS grid, with the column matching the carousel's centered card
// highlighted. See compare-leader-chips.spec.ts for the leader-chip tests
// this file used to share a component with.
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

test.describe("At a glance table", () => {
  test("renders exactly once, with the correct price/rating/delivery per item", async ({ page }) => {
    await buildKnownDeck(page);
    await expect(page.getByTestId("at-a-glance-table")).toHaveCount(1);
    const table = page.getByTestId("at-a-glance-table");
    // Roadster ₹899/4.1★, HERE&NOW ₹649/3.6★, Peter England ₹999/4.3★
    await expect(table.locator('[data-cell="price:shirt-roadster-001"]')).toHaveText("₹899");
    await expect(table.locator('[data-cell="price:shirt-hereandnow-001"]')).toHaveText("₹649");
    await expect(table.locator('[data-cell="price:shirt-peterengland-001"]')).toHaveText("₹999");
    await expect(table.locator('[data-cell="rating:shirt-roadster-001"]')).toHaveText("4.1★");
  });

  test("the active column highlight tracks the carousel as it swipes", async ({ page }) => {
    await buildKnownDeck(page);
    const table = page.getByTestId("at-a-glance-table");
    const roadsterCell = table.locator('[data-cell="price:shirt-roadster-001"]');
    const hereandnowCell = table.locator('[data-cell="price:shirt-hereandnow-001"]');
    await expect(roadsterCell).toHaveClass(/bg-brand-tint/);
    await expect(hereandnowCell).not.toHaveClass(/bg-brand-tint/);

    await page.getByRole("button", { name: "Next item" }).click();
    await expect(hereandnowCell).toHaveClass(/bg-brand-tint/);
    await expect(roadsterCell).not.toHaveClass(/bg-brand-tint/);
  });

  test("shows correct 'your size' availability once inventory resolves", async ({ page }) => {
    // Same known-deterministic deck as the retired summary-strip test:
    // Roadster -> M is seeded at 0 units (unavailable), HERE&NOW -> S and
    // Peter England -> M both have real stock (available).
    await buildKnownDeck(page);
    const table = page.getByTestId("at-a-glance-table");
    await expect(table.locator('[data-cell="size:shirt-roadster-001"]').getByLabel("Not available")).toBeVisible({
      timeout: 10_000,
    });
    await expect(table.locator('[data-cell="size:shirt-hereandnow-001"]').getByLabel("Available")).toBeVisible();
    await expect(table.locator('[data-cell="size:shirt-peterengland-001"]').getByLabel("Available")).toBeVisible();
  });

  test("the position indicator (N of M) is unaffected by the table", async ({ page }) => {
    await buildKnownDeck(page);
    await expect(page.getByText("1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next item" }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
  });
});
