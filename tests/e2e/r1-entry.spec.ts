import { test, expect } from "@playwright/test";
import { selectCategory, tapCompare } from "./helpers";

test.describe("R1 — entry point", () => {
  test("1.1 Compare button present when Shirts is active", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Shirts");
    await expect(page.getByRole("button", { name: "Compare", exact: true })).toBeVisible();
  });

  test("1.2 Compare button present when Pants is active", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Pants");
    await expect(page.getByRole("button", { name: "Compare", exact: true })).toBeVisible();
  });

  test("1.3 Compare is disabled on All Items, with a visible reason", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "All Items");
    const btn = page.getByRole("button", { name: "Compare", exact: true });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText(/select shirts or pants to compare/i)).toBeVisible();
  });

  test("1.4 Tapping Compare enters selection mode with no URL change and no screen transition", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Shirts");
    await tapCompare(page);
    await expect(page).toHaveURL(/\/wishlist$/);
    // the wishlist grid is still mounted — product tiles are still present
    await expect(page.locator('button[aria-pressed]').first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wishlist" })).toBeVisible();
  });

  test("1.5 Compare is disabled when the active category has fewer than 2 saved items", async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Pants");
    // remove pants down to 1 via the wishlist heart affordance
    const removeButtons = page.locator('button[aria-label^="Remove"]');
    let count = await removeButtons.count();
    while (count > 1) {
      await removeButtons.first().click();
      count = await removeButtons.count();
    }
    const btn = page.getByRole("button", { name: "Compare", exact: true });
    await expect(btn).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText(/save at least 2 items in this category/i)).toBeVisible();
  });
});
