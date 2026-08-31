import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { buildDeck, selectCategory, tapCompare, confirmCompare } from "./helpers";

async function selectByLabel(page: Page, labelSubstrings: string[]) {
  await page.goto("/wishlist");
  await selectCategory(page, "Shirts");
  await tapCompare(page);
  for (const substr of labelSubstrings) {
    await page.locator(`button[aria-label*="${substr}"]`).click();
  }
  await confirmCompare(page);
}

// D8: Add to Bag moved from one button per card to a single sticky button
// acting on whichever card is currently centered — still pinned outside
// the scrollable area (RULES E3), just at the page level now instead of
// per-card. "Remove from wishlist" is now the heart icon on each carousel
// slide, with a product-specific aria-label (matching the wishlist tile's
// own pattern) rather than the old CardActions' generic "Remove from
// wishlist" button text.
test.describe("R6 — actions", () => {
  test("6.1 Add to Bag stays visible without scrolling as the active card changes", async ({ page }) => {
    await buildDeck(page, "Shirts", 4);
    const viewport = page.viewportSize()!;
    const addToBag = page.getByRole("button", { name: /Add to Bag|Added to Bag/ });
    for (let i = 0; i < 4; i++) {
      const box = await addToBag.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      if (i < 3) await page.getByRole("button", { name: "Next item" }).click();
    }
  });

  test("6.2 Add to Bag increments the bag and shows in-place confirmation", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    await page.getByRole("button", { name: "Add to Bag" }).click();
    await expect(page.getByRole("button", { name: "Added to Bag" })).toBeVisible();
    await expect(page.getByTestId("bag-count")).toHaveText("1");
  });

  test("6.3 Add to Bag does not exit or advance the deck", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await page.getByRole("button", { name: "Next item" }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Add to Bag" }).click();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByText("2 of 3")).toBeVisible();
  });

  test("6.4 'See product' opens the PDP", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    await page.locator('[data-card-active="true"]').getByRole("link", { name: "See product" }).click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.getByRole("button", { name: "Add to Bag" })).toBeVisible();
  });

  test("6.5 returning from the PDP restores the same deck index", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await page.getByRole("button", { name: "Next item" }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
    await page.locator('[data-card-active="true"]').getByRole("link", { name: "See product" }).click();
    await expect(page).toHaveURL(/\/product\//);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByText("2 of 3")).toBeVisible();
  });

  test("6.6 Remove from wishlist (the heart icon) is present on every card", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.locator('button[aria-label^="Remove "][aria-label$=" from wishlist"]')).toHaveCount(3);
  });

  test("6.8 removing drops the item from wishlist and deck immediately", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.getByText("1 of 3")).toBeVisible();
    await page.locator('button[aria-label^="Remove "][aria-label$=" from wishlist"]').first().click();
    await expect(page.getByText("1 of 2")).toBeVisible();
  });

  test("6.9 indicator and deck length update without exiting comparison mode (4 -> 3)", async ({ page }) => {
    await buildDeck(page, "Shirts", 4);
    await expect(page.getByText("1 of 4")).toBeVisible();
    await page.locator('button[aria-label^="Remove "][aria-label$=" from wishlist"]').first().click();
    await expect(page).toHaveURL(/\/compare$/); // still in comparison mode
    await expect(page.getByText("1 of 3")).toBeVisible();
  });

  test("6.10 removing down to 1 item returns to the wishlist with an explanation", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    await page.locator('button[aria-label^="Remove "][aria-label$=" from wishlist"]').first().click();
    await expect(page).toHaveURL(/\/wishlist$/);
    await expect(page.getByRole("status")).toContainText(/removed/i);
  });

  test("6.11 the removed item is gone from the wishlist on return", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    await page.locator('button[aria-label="Remove Roadster Slim Fit Cotton Casual Shirt from wishlist"]').click();
    await expect(page).toHaveURL(/\/wishlist$/);
    await expect(page.locator('button[aria-label*="Roadster Slim Fit Cotton Casual Shirt"]')).toHaveCount(0);
  });
});
