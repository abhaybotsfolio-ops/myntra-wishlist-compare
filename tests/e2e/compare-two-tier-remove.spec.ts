import { test, expect } from "@playwright/test";
import { buildDeck } from "./helpers";

// D8: two distinct removal actions, matching the reference prototype — the
// heart icon unsaves from the wishlist entirely (cascading out of the
// active comparison too), the X icon removes from this comparison only
// and leaves the item on the wishlist. Both offer an Undo action on their
// toast, restoring the item to its pre-removal position.
test.describe("Two-tier remove (heart vs. X) and Undo", () => {
  test("the X icon removes from compare only — item stays on the wishlist", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    const removeFromCompareBtn = page.locator('button[aria-label*="from this comparison"]').first();
    const label = await removeFromCompareBtn.getAttribute("aria-label");
    const name = label!.replace(/^Remove /, "").replace(/ from this comparison$/, "");

    await removeFromCompareBtn.click();
    await expect(page.getByText("1 of 2")).toBeVisible(); // still in compare, one fewer
    await expect(page).toHaveURL(/\/compare$/);

    // still on the wishlist — matched by the tile's image alt (the exact
    // "brand title" combo), not a text fragment that can collide across
    // two products from the same brand.
    await page.goto("/wishlist");
    await expect(page.locator(`img[alt="${name}"]`)).toBeVisible();
  });

  test("the heart icon unsaves from the wishlist entirely, dropping out of compare too", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    const heartBtn = page.locator('button[aria-label^="Remove "][aria-label$=" from wishlist"]').first();
    const label = await heartBtn.getAttribute("aria-label");
    const name = label!.replace(/^Remove /, "").replace(/ from wishlist$/, "");

    await heartBtn.click();
    await expect(page.getByText("1 of 2")).toBeVisible();

    await page.goto("/wishlist");
    await expect(page.locator(`img[alt="${name}"]`)).toHaveCount(0);
  });

  test("Undo after removing from compare restores the item to the deck", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.getByText("1 of 3")).toBeVisible();
    await page.locator('button[aria-label*="from this comparison"]').first().click();
    await expect(page.getByText("1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("1 of 3")).toBeVisible();
  });

  test("Undo after unsaving restores the item to both the wishlist and the deck", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.getByText("1 of 3")).toBeVisible();
    await page.locator('button[aria-label^="Remove "][aria-label$=" from wishlist"]').first().click();
    await expect(page.getByText("1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("1 of 3")).toBeVisible();
  });

  test("removing from compare down to 1 item redirects to the wishlist without an Undo option", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    await page.locator('button[aria-label*="from this comparison"]').first().click();
    await expect(page).toHaveURL(/\/wishlist$/);
    await expect(page.getByRole("status")).toContainText(/only 1 left/i);
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  });
});
