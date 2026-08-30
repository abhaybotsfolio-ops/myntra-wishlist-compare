import { test, expect } from "@playwright/test";
import { buildDeck } from "./helpers";

test.describe("Cross-cutting", () => {
  test("X.3 no category other than Shirts and Pants appears in any surface", async ({ page }) => {
    await page.goto("/wishlist");
    const tabNames = await page.getByRole("tab").allTextContents();
    expect(tabNames.sort()).toEqual(["All Items", "Pants", "Shirts"]);
  });

  test("X.6 no console errors across the full flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await buildDeck(page, "Shirts", 3);
    await page.getByRole("button", { name: "Next item" }).click();
    const activeCard = page.locator('[data-card-active="true"]');
    await activeCard.getByRole("button", { name: "Add to Bag" }).click();
    await activeCard.getByRole("button", { name: "Remove from wishlist" }).click();
    await page.getByRole("button", { name: "Back to wishlist" }).click().catch(() => {});

    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("X.7 all tap targets are at least 44x44px", async ({ page }) => {
    await buildDeck(page, "Shirts", 2);
    const buttons = await page.locator('button, a[href^="/product"]').all();
    const tooSmall: string[] = [];
    for (const btn of buttons) {
      if (!(await btn.isVisible())) continue;
      const box = await btn.boundingBox();
      if (!box) continue;
      if (box.width < 44 || box.height < 44) {
        const label = (await btn.getAttribute("aria-label")) ?? (await btn.textContent()) ?? "(unnamed)";
        tooSmall.push(`${label.trim()}: ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }
    expect(tooSmall, tooSmall.join("\n")).toEqual([]);
  });
});
