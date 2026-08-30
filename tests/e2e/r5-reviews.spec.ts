import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";

async function selectByLabel(page: Page, labelSubstrings: string[]) {
  await page.goto("/wishlist");
  await selectCategory(page, "Shirts");
  await tapCompare(page);
  for (const substr of labelSubstrings) {
    await page.locator(`button[aria-label*="${substr}"]`).click();
  }
  await confirmCompare(page);
}

test.describe("R5 — review summary", () => {
  test("5.1 cards above threshold show 2-3 themes", async ({ page }) => {
    // Roadster (rich-positive, 30) + HERE&NOW Poplin (rich-mixed, 26)
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "HERE&NOW Relaxed Fit Cotton Poplin Shirt"]);
    for (const row of await page.locator('[data-row="reviews"]').all()) {
      const themeLabels = row.locator("p.font-semibold");
      const n = await themeLabels.count();
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  test("5.2 themes cite review evidence (from N reviews)", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "HERE&NOW Relaxed Fit Cotton Poplin Shirt"]);
    await expect(page.getByText(/from \d+ reviews/).first()).toBeVisible();
  });

  test("5.3 a mixed-sentiment SKU shows at least one negative or mixed theme", async ({ page }) => {
    // shirt-hereandnow-001 is the known rich-mixed SKU (shoulders run large)
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "HERE&NOW Relaxed Fit Cotton Poplin Shirt"]);
    await expect(page.getByText("Shoulders run large")).toBeVisible();
  });

  test("5.4 below-threshold SKUs read 'Not enough reviews yet'", async ({ page }) => {
    // shirt-vanheusen-002 has 3 reviews, below REVIEW_THRESHOLD (8)
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);
    await expect(page.getByText("Not enough reviews yet")).toBeVisible();
  });

  test("5.5 no LLM request is made for a below-threshold SKU", async ({ page }) => {
    const requestBodies: string[] = [];
    await page.route("**/api/summarize", async (route) => {
      requestBodies.push(route.request().postData() ?? "");
      await route.continue();
    });
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Van Heusen Slim Fit Wrinkle-Free Shirt"]);
    await expect(page.getByText("Not enough reviews yet")).toBeVisible();
    const allSkus = requestBodies.map((b) => JSON.parse(b || "{}").skus ?? []).flat();
    expect(allSkus).not.toContain("shirt-vanheusen-002");
    expect(allSkus).toContain("shirt-roadster-001");
  });

  test("5.6 with GEMINI_API_KEY unset, every card still shows a summary and no error UI", async ({ page }) => {
    // This suite runs with no key configured (see .env.example / README) —
    // every test above already exercises this path. This test asserts the
    // negative space explicitly: no error text anywhere on the card.
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "HERE&NOW Relaxed Fit Cotton Poplin Shirt"]);
    await expect(page.locator('[data-row="reviews"]').first()).not.toBeEmpty();
    await expect(page.getByText(/error|failed|something went wrong/i)).toHaveCount(0);
  });
});
