import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { selectCategory, tapCompare, confirmCompare } from "./helpers";

/** Selects specific known products by their tile aria-label substring,
 * rather than "first N unselected" — several of these tests need a
 * specific brand (signalled vs unsignalled, currently available vs
 * already out of stock in the recommended size) to exercise a specific
 * branch, not whatever the seed happens to sort first. */
async function selectByLabel(page: Page, labelSubstrings: string[]) {
  await page.goto("/wishlist");
  await selectCategory(page, "Shirts");
  await tapCompare(page);
  for (const substr of labelSubstrings) {
    await page.locator(`button[aria-label*="${substr}"]`).click();
  }
  await confirmCompare(page);
}

test.describe("R4 — size wedge", () => {
  test("4.1 every card shows a recommended size or the general size guide, never blank", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    const wedges = page.locator('[data-row="size"]');
    await expect(wedges).toHaveCount(2);
    for (const wedge of await wedges.all()) {
      await expect(wedge).not.toBeEmpty();
    }
  });

  test("4.2 available/unavailable status is shown for the recommended size", async ({ page }) => {
    // Roadster -> M, pre-seeded as out of stock from the start
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    await expect(page.getByText(/Your size: M · Out of stock/)).toBeVisible();
  });

  test("4.3 the recommendation displays its basis", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    await expect(page.getByText("You bought M in Roadster twice")).toBeVisible();
  });

  test("4.4 a brand with no size signal renders the general size guide, not a guessed size", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    await expect(page.getByText("Size guide")).toBeVisible();
    await expect(page.getByText(/we don.t have your size history/i)).toBeVisible();
    // no fabricated size badge for Highlander anywhere on its card
    await expect(page.getByText(/Your size: .* · /)).toHaveCount(1); // only Roadster's
  });

  test("4.5 an item unavailable in the user's size stays in the deck, readable, not filtered", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    await expect(page.getByText("1 of 2")).toBeVisible(); // deck still has both — Roadster (unavailable) is card 1
    await expect(page.getByText("Roadster", { exact: true })).toBeVisible();
    await expect(page.getByText("Slim Fit Cotton Casual Shirt")).toBeVisible();
    await expect(page.getByText(/Out of stock/)).toBeVisible(); // fully readable, wedge intact
  });

  test("4.6 Add to Bag is disabled with a stated reason when the recommended size is unavailable", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    const addToBag = page.getByRole("button", { name: /Add to Bag/ }).first();
    await expect(addToBag).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Unavailable in your size (M)")).toBeVisible();
  });

  test("4.7 stock change mid-session updates the wedge in place", async ({ page }) => {
    // HERE&NOW -> S is available at the start; rewrite deckStartedAt into
    // the past so the resolved event (real server-side resolution against
    // this exact deck, DECISIONS.md D4) is close to due — without a real
    // 15s wait (the server, not the browser, owns elapsed time here, so
    // the browser's clock can't be mocked to skip it directly).
    //
    // Landing *past* the threshold and reloading was tried first and
    // correctly updated the wedge, but never fired the toast: a reload
    // re-mounts useInventory with an empty prevRef, so the very first
    // poll after reload — already showing the dropped state — has no
    // "available" baseline to diff against and treats it as initial load,
    // not a change. Landing *just before* the threshold instead gives the
    // first post-reload poll a real baseline (still available), then lets
    // the natural next poll (no further reload) cross the threshold and
    // detect the real transition — the same mechanism a live session uses,
    // which is exactly what caught this in the first place (verified live
    // in-browser during Phase 6, toast and all).
    await selectByLabel(page, ["HERE&NOW Tapered Fit Linen Shirt", "Highlander"]);
    await expect(page.getByText(/Your size: S · In stock/)).toBeVisible();

    await page.evaluate(() => {
      const raw = JSON.parse(sessionStorage.getItem("myntra-compare-session")!);
      raw.state.deckStartedAt = Date.now() - 10_000; // 10s in — before the 15s event, after hydration settles
      sessionStorage.setItem("myntra-compare-session", JSON.stringify(raw));
    });
    await page.reload();
    await expect(page.getByText(/Your size: S · In stock/)).toBeVisible(); // real baseline established post-reload

    // toast is ephemeral (auto-dismisses); check it before the wedge state,
    // which persists in the DOM and can safely be checked after
    await expect(page.getByRole("status")).toContainText("out of stock", { timeout: 15_000 });
    await expect(page.getByText(/Your size: S · Out of stock/)).toBeVisible();
  });

  test("4.8 polling pauses when the tab is hidden", async ({ page }) => {
    await selectByLabel(page, ["Roadster Slim Fit Cotton Casual Shirt", "Highlander"]);
    let inventoryRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/inventory")) inventoryRequests++;
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    inventoryRequests = 0; // reset after the hide transition itself
    await page.waitForTimeout(9_000); // longer than the 8s poll interval
    expect(inventoryRequests).toBe(0);
  });
});
