import type { Page } from "@playwright/test";

export async function selectCategory(page: Page, category: "Shirts" | "Pants" | "All Items") {
  await page.getByRole("tab", { name: category }).click();
}

export async function tapCompare(page: Page) {
  await page.getByRole("button", { name: "Compare", exact: true }).click();
}

/** Selects the first `n` currently-unselected tiles in selection mode.
 * Scoped to the tile checkbox's aria-label prefix ("Select ..."), not just
 * `[aria-pressed="false"]` — the wishlist screen's Out of Stock filter pill
 * is also a toggle button and also starts at aria-pressed="false", and
 * being earlier in the DOM than the grid, a bare aria-pressed locator
 * matches it first instead of a tile. */
export async function selectNItems(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.locator('button[aria-label^="Select "]').first().click();
  }
}

export async function confirmCompare(page: Page) {
  await page.getByRole("button", { name: /^Compare \d/ }).click();
  await page.waitForURL("**/compare");
}

/** Full happy path: category -> Compare -> select n -> confirm -> lands on
 * /compare with a frozen deck of n items. */
export async function buildDeck(page: Page, category: "Shirts" | "Pants", n: number) {
  await page.goto("/wishlist");
  await selectCategory(page, category);
  await tapCompare(page);
  await selectNItems(page, n);
  await confirmCompare(page);
}

