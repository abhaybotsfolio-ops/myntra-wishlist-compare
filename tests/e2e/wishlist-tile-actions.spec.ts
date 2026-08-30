import { test, expect } from "@playwright/test";

test.describe("Wishlist tile actions", () => {
  test("Add to Bag pill increments the bag and confirms, without navigating away", async ({ page }) => {
    await page.goto("/wishlist");
    const addBtn = page.locator('button[aria-label^="Add "][aria-label$=" to bag"]').first();
    // Capture which product this is before clicking — once it's bagged, its
    // own aria-label no longer starts with "Add ", so re-querying the same
    // `.first()` locator would (correctly) land on the *next* unbagged
    // item, not this one; asserting on the name we clicked avoids that.
    const label = await addBtn.getAttribute("aria-label");
    const name = label!.replace(/^Add /, "").replace(/ to bag$/, "");
    await addBtn.click();
    await expect(page).toHaveURL(/\/wishlist$/);
    await expect(page.getByRole("status")).toContainText(/added/i);
    await expect(page.getByTestId("bag-count")).toHaveText("1");
    await expect(page.locator(`button[aria-label="${name} added to bag"]`)).toBeVisible();
  });

  test("Move to Bag removes the item from the wishlist and adds it to the bag in one tap", async ({ page }) => {
    await page.goto("/wishlist");
    const moveButtons = page.locator('button[aria-label^="Move "]');
    const before = await moveButtons.count();
    await moveButtons.first().click();
    await expect(page.getByRole("status")).toContainText(/moved/i);
    await expect(page.getByTestId("bag-count")).toHaveText("1");
    await expect(moveButtons).toHaveCount(before - 1);
  });

  test("Share copies a product link to the clipboard when the Web Share API is unavailable", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/wishlist");
    await page.evaluate(() => {
      // Force the clipboard fallback path deterministically, regardless of
      // whether this browser/OS combination happens to expose navigator.share.
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.locator('button[aria-label^="Share "]').first().click();
    await expect(page.getByRole("status")).toContainText(/copied/i);
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("/product/");
  });

  test("an out-of-stock tile shows the label and disables Add-to-Bag and Move-to-Bag", async ({ page }) => {
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Out of Stock", exact: true }).click();
    const addBtn = page.locator('button[aria-label$=" is out of stock"]').first();
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveAttribute("aria-disabled", "true");
    const moveBtn = page.locator('button[aria-label^="Move "]').first();
    await expect(moveBtn).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Out of stock", { exact: true }).first()).toBeVisible();
  });

  test("new tile action buttons meet the 44x44 minimum tap target", async ({ page }) => {
    await page.goto("/wishlist");
    for (const selector of [
      'button[aria-label^="Add "]',
      'button[aria-label^="Move "]',
      'button[aria-label^="Share "]',
      'button[aria-label^="Remove "]',
    ]) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${selector} should have a bounding box`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
