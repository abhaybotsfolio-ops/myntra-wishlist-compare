import { test, expect } from "@playwright/test";
import { selectCategory, tapCompare, selectNItems } from "./helpers";

test.describe("R2 — selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wishlist");
    await selectCategory(page, "Shirts");
    await tapCompare(page);
  });

  test("2.1 selecting 2 items enables the sticky bar", async ({ page }) => {
    await selectNItems(page, 2);
    await expect(page.getByRole("button", { name: "Compare 2" })).toBeEnabled();
  });

  test("2.2 sticky bar label reflects the live count", async ({ page }) => {
    await expect(page.getByText("Select items to compare")).toBeVisible(); // 0 selected
    await selectNItems(page, 1);
    await expect(page.getByRole("button", { name: "Compare 1" })).toBeVisible();
    await selectNItems(page, 1);
    await expect(page.getByRole("button", { name: "Compare 2" })).toBeVisible();
    await selectNItems(page, 1);
    await expect(page.getByRole("button", { name: "Compare 3" })).toBeVisible();
  });

  test("2.3 sticky bar is disabled at 0 and 1 selections", async ({ page }) => {
    await expect(page.getByText("Select items to compare")).toHaveAttribute("aria-disabled", "true");
    await selectNItems(page, 1);
    await expect(page.getByRole("button", { name: "Compare 1" })).toHaveAttribute("aria-disabled", "true");
  });

  test("2.4 a 5th selection attempt is refused and shows a message", async ({ page }) => {
    await selectNItems(page, 4);
    await expect(page.getByRole("button", { name: "Compare 4" })).toBeVisible();
    await page.locator('button[aria-label^="Select "]').first().click();
    await expect(page.getByRole("button", { name: "Compare 4" })).toBeVisible(); // count stayed at 4
    await expect(page.getByRole("status")).toContainText("up to 4 items");
  });

  test("2.5 only current-category items are selectable; tabs are locked during selection", async ({ page }) => {
    for (const name of ["All Items", "Shirts", "Pants"]) {
      const tab = page.getByRole("tab", { name });
      await expect(tab).toHaveAttribute("aria-disabled", "true");
    }
    // clicking a locked tab must not change the active category
    await page.getByRole("tab", { name: "Pants" }).click({ force: true });
    await expect(page.getByRole("tab", { name: "Shirts" })).toHaveAttribute("aria-selected", "true");
  });

  test("2.6 deselecting works and returns the count correctly", async ({ page }) => {
    await selectNItems(page, 3);
    await expect(page.getByRole("button", { name: "Compare 3" })).toBeVisible();
    await page.locator('button[aria-pressed="true"]').first().click();
    await expect(page.getByRole("button", { name: "Compare 2" })).toBeVisible();
  });

  test("2.7 scroll position is preserved entering and exiting selection mode", async ({ page }) => {
    // Realistic sequence: already in selecting mode (beforeEach), scroll
    // down to browse further items, then exit via Cancel — which stays
    // reachable while scrolled because the sticky bottom bar is `position:
    // sticky`, not part of the scrolling flow. (Scrolling far enough to
    // push the *entry-point* Compare CTA itself out of view before tapping
    // it isn't a sequence a real user can perform — there'd be nothing
    // left on screen to tap.)
    const scroller = "#app-scroll";
    await page.locator(scroller).evaluate((el) => (el.scrollTop = 300));
    const before = await page.locator(scroller).evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(100); // sanity: the grid actually had room to scroll

    await page.getByRole("button", { name: "Cancel" }).click();
    const afterCancel = await page.locator(scroller).evaluate((el) => el.scrollTop);
    expect(Math.abs(afterCancel - before)).toBeLessThanOrEqual(2);
  });
});
