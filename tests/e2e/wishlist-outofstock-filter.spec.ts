import { test, expect } from "@playwright/test";
import { selectCategory, tapCompare } from "./helpers";

// data/inventory.json seeds exactly one fully-out-of-stock SKU:
// shirt-highlander-001 (every size at 0 units) — see generate-seed.ts's
// FULLY_OUT_OF_STOCK_SKU and the seed invariant that requires >=1.
test.describe("Wishlist — Out of Stock filter", () => {
  test("toggling shows only fully out-of-stock items", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "All Items");
    const filterPill = page.getByRole("button", { name: "Out of Stock", exact: true });
    await filterPill.click();
    await expect(filterPill).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Highlander")).toBeVisible();
    // exact + case-sensitive: the tile badge reads "Out of stock" (lowercase
    // s), distinct from the filter pill's own "Out of Stock" label text,
    // which getByText's default case-insensitive substring match would
    // otherwise also count.
    await expect(page.getByText("Out of stock", { exact: true })).toHaveCount(1);
  });

  test("composes with the category filter (AND), not a replacement", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Pants");
    await page.getByRole("button", { name: "Out of Stock", exact: true }).click();
    // Highlander is a shirt — no out-of-stock pants exist in the seed data.
    await expect(page.getByText(/no out-of-stock items in this category/i)).toBeVisible();
  });

  test("clearing the filter restores the full category view", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Shirts");
    const filterPill = page.getByRole("button", { name: "Out of Stock", exact: true });
    await filterPill.click();
    await expect(page.getByText("Highlander")).toBeVisible();
    await filterPill.click();
    await expect(filterPill).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Roadster").first()).toBeVisible();
  });

  test("locks while selecting, same as the category tabs", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Shirts");
    await tapCompare(page);
    const filterPill = page.getByRole("button", { name: "Out of Stock", exact: true });
    await expect(filterPill).toHaveAttribute("aria-disabled", "true");
  });
});
