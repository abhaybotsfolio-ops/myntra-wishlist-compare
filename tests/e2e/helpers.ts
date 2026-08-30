import type { Page } from "@playwright/test";

export async function selectCategory(page: Page, category: "Shirts" | "Pants" | "All Items") {
  await page.getByRole("tab", { name: category }).click();
}

export async function tapCompare(page: Page) {
  await page.getByRole("button", { name: "Compare", exact: true }).click();
}

/** Selects the first `n` currently-unselected tiles in selection mode. */
export async function selectNItems(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.locator('button[aria-pressed="false"]').first().click();
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

export async function rowTop(page: Page, key: string, nth = 0) {
  const box = await page.locator(`[data-row="${key}"]`).nth(nth).boundingBox();
  if (!box) throw new Error(`row ${key}[${nth}] has no bounding box`);
  return box.y;
}
