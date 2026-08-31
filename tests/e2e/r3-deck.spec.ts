import { test, expect } from "@playwright/test";
import { buildDeck } from "./helpers";

// D8: the old per-card ATTRIBUTE_ROWS/data-row pixel-alignment mechanic
// (3.5/3.6 originally) no longer applies — the compare screen was rebuilt
// around a compact carousel plus a shared comparison table below it. A CSS
// grid table guarantees column alignment natively; what's tested below
// instead is that the table's rows and columns are actually structured the
// way the design intends (real regression coverage, not just "trust the
// grid").
test.describe("R3 — comparison deck", () => {
  test("3.1 each selected item renders as its own carousel slide; deck length equals selection count", async ({
    page,
  }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.locator("[data-card-active]")).toHaveCount(3);
  });

  test("3.2 drag-swipe advances the deck", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.getByText("1 of 3")).toBeVisible();
    const slide = page.locator('[data-card-active="true"]').first();
    const box = (await slide.boundingBox())!;
    const startX = box.x + box.width / 2;
    const y = box.y + 20;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    // Paced, not a single steps:N jump straight into mouse.up() — framer
    // motion batches drag updates through its own requestAnimationFrame
    // scheduler, so the gesture needs real time between samples to be
    // recognized as a drag at all.
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX - i * 25, y);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await expect(page.getByText("2 of 3")).toBeVisible();
  });

  test("3.3 tap navigation advances the deck", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await page.getByRole("button", { name: "Next item" }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Previous item" }).click();
    await expect(page.getByText("1 of 3")).toBeVisible();
  });

  test("3.4 position indicator shows both dots and 'N of M', always visible", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible();
    const dotCount = await page.getByTestId("position-dots").locator("> span").count();
    expect(dotCount).toBe(3);
  });

  test("3.6 the At a glance table's rows are ordered Price, Rating, Your size, Delivery", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    const table = page.getByTestId("at-a-glance-table");
    const rowKeys = await table.locator("[data-row]").evaluateAll((els) => els.map((el) => el.getAttribute("data-row")));
    expect(rowKeys).toEqual(["price", "rating", "size", "delivery"]);
  });

  test("3.7 a no-signal item's size renders an em-dash in the table, never blank or a guessed size", async ({
    page,
  }) => {
    // Highlander and WROGN are the two deliberately unsignalled brands
    // (DECISIONS.md D2) — Highlander is fully out of stock (D7) so use
    // WROGN instead to keep this test about "no signal", not stock.
    await page.goto("/wishlist");
    await page.getByRole("tab", { name: "Pants" }).click();
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page.locator('button[aria-label^="Select WROGN "]').click();
    await page.locator('button[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /^Compare \d/ }).click();
    await page.waitForURL("**/compare");
    const sizeRow = page.getByTestId("at-a-glance-table").locator('[data-row="size"]');
    await expect(sizeRow).toContainText("—");
  });

  test("3.8 deck and index survive backgrounding", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await page.getByRole("button", { name: "Next item" }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.reload();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByText("2 of 3")).toBeVisible();
  });
});
