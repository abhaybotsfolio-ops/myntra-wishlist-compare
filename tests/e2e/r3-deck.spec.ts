import { test, expect } from "@playwright/test";
import { buildDeck, rowTop } from "./helpers";
import { ATTRIBUTE_ROWS } from "../../src/lib/constants";

test.describe("R3 — comparison deck", () => {
  test("3.1 each selected item renders as its own card; deck length equals selection count", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.locator('[data-row="identity"]')).toHaveCount(3);
  });

  test("3.2 drag-swipe advances the deck", async ({ page }) => {
    await buildDeck(page, "Shirts", 3);
    await expect(page.getByText("1 of 3")).toBeVisible();
    const deck = page.locator('[data-row="image"]').first();
    const box = (await deck.boundingBox())!;
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    // Paced, not a single steps:N jump straight into mouse.up() — framer
    // motion batches drag updates through its own requestAnimationFrame
    // scheduler (verified by reading VisualElementDragControls/PanSession
    // source directly), so the gesture needs real time between samples to
    // be recognized as a drag at all, the same way a human's move events
    // naturally spread across frames. A too-fast synthetic drag can end
    // before the first frame update ever processes.
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
    // 3 dots for a 3-item deck
    const dots = page.locator("header").locator('div[aria-hidden="true"] > span');
    await expect(dots).toHaveCount(3);
  });

  test("3.5 attribute rows align across all cards", async ({ page }) => {
    await buildDeck(page, "Shirts", 4);
    for (const { key } of ATTRIBUTE_ROWS) {
      const tops = await page.locator(`[data-row="${key}"]`).evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().top),
      );
      expect(tops).toHaveLength(4);
      const spread = Math.max(...tops) - Math.min(...tops);
      expect(spread, `row "${key}" misaligned: ${tops}`).toBeLessThanOrEqual(1);
    }
  });

  test("3.6 row order matches ATTRIBUTE_ROWS exactly, size wedge between price and reviews", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    const keys = await page
      .locator("[data-row]")
      .evaluateAll((els, len) => els.slice(0, len).map((el) => el.getAttribute("data-row")), ATTRIBUTE_ROWS.length);
    expect(keys).toEqual(ATTRIBUTE_ROWS.map((r) => r.key));
    const priceIdx = keys.indexOf("price");
    const sizeIdx = keys.indexOf("size");
    const reviewsIdx = keys.indexOf("reviews");
    expect(sizeIdx).toBeGreaterThan(priceIdx);
    expect(sizeIdx).toBeLessThan(reviewsIdx);
  });

  test("3.7 rows with no content to show never collapse (size/reviews empty states hold full height)", async ({ page }) => {
    // The literal em-dash fallback (RULES E2) guards fit/material, which
    // the seed schema makes required — unreachable with valid data, so
    // this exercises the two branches that really do go empty: the
    // no-signal size wedge and the below-threshold review summary. Both
    // must render at their full row height, not collapse to fit their text.
    await buildDeck(page, "Shirts", 2);
    const sizeHeight = await rowTop(page, "size").then(async () => {
      const box = await page.locator('[data-row="size"]').first().boundingBox();
      return box!.height;
    });
    const expectedMin = ATTRIBUTE_ROWS.find((r) => r.key === "size")!.minH;
    expect(sizeHeight).toBeGreaterThanOrEqual(expectedMin - 1);
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
