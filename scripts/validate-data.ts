/**
 * `npm run validate:data` — BUILD_PLAN.md Phase 2 gate.
 *
 * Zod-parses every file in /data, then re-derives the invariants the
 * acceptance tests depend on directly from that data (not from generator
 * intent) — so if someone hand-edits a JSON file later and drifts away from
 * what ACCEPTANCE.md needs, this fails loudly instead of the drift being
 * discovered by a flaky Playwright run. RULES.md F4.
 *
 * Exit non-zero on any failure.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ProductsFileSchema,
  ReviewsFileSchema,
  InventorySchema,
  SizeProfileSchema,
  StockEventsFileSchema,
  SummariesFallbackFileSchema,
} from "../data/schema.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const REVIEW_THRESHOLD = 8;

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

function readJson(name: string): unknown {
  const p = path.join(DATA_DIR, name);
  if (!existsSync(p)) {
    fail(`missing data/${name}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`data/${name} is not valid JSON: ${(e as Error).message}`);
    return undefined;
  }
}

function zparse<T>(name: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } }, raw: unknown): T | undefined {
  if (raw === undefined) return undefined;
  const result = schema.safeParse(raw);
  if (!result.success) {
    fail(`data/${name} failed schema validation:\n    ${JSON.stringify(result.error?.issues).slice(0, 2000)}`);
    return undefined;
  }
  return result.data;
}

const products = zparse("products.json", ProductsFileSchema, readJson("products.json"));
const reviews = zparse("reviews.json", ReviewsFileSchema, readJson("reviews.json"));
const inventory = zparse("inventory.json", InventorySchema, readJson("inventory.json"));
const sizeProfile = zparse("size-profile.json", SizeProfileSchema, readJson("size-profile.json"));
const stockEvents = zparse("stock-events.json", StockEventsFileSchema, readJson("stock-events.json"));
const summaries = zparse("summaries.fallback.json", SummariesFallbackFileSchema, readJson("summaries.fallback.json"));

if (!products || !reviews || !inventory || !sizeProfile || !stockEvents || !summaries) {
  report();
}

// From here on, all six files parsed — cross-file invariant checks.
if (products && reviews && inventory && sizeProfile && stockEvents && summaries) {
  const shirts = products.filter((p) => p.category === "shirts");
  const pants = products.filter((p) => p.category === "pants");
  if (shirts.length !== 9) fail(`expected 9 shirts, got ${shirts.length}`);
  if (pants.length !== 7) fail(`expected 7 pants, got ${pants.length}`);

  const ids = new Set(products.map((p) => p.id));
  if (ids.size !== products.length) fail("duplicate product ids");

  const prices = products.map((p) => p.price);
  if (Math.min(...prices) > 550) fail(`min price ${Math.min(...prices)} not close to the ~499 floor`);
  if (Math.max(...prices) < 3400) fail(`max price ${Math.max(...prices)} not close to the ~3499 ceiling`);
  for (const cat of ["shirts", "pants"] as const) {
    const catPrices = products.filter((p) => p.category === cat).map((p) => p.price).sort((a, b) => a - b);
    const minGap = Math.min(...catPrices.slice(1).map((p, i) => p - catPrices[i]));
    if (minGap > 150) fail(`no in-category close price pair (<=150) in ${cat}, min gap ${minGap}`);
  }
  const ratings = products.map((p) => p.rating);
  if (Math.max(...ratings) - Math.min(...ratings) < 1.0) fail("rating spread under 1.0 — too clustered");

  for (const p of products) {
    if (!/^Delivery by /.test(p.deliveryEstimate)) {
      fail(`${p.id} deliveryEstimate malformed: "${p.deliveryEstimate}"`);
    }
  }

  // Review-count-and-sentiment-derived bands, matching catalog-seed skill's table.
  const reviewsBySku = new Map<string, typeof reviews>();
  for (const r of reviews) {
    if (!ids.has(r.sku)) fail(`review ${r.id} references unknown sku ${r.sku}`);
    reviewsBySku.set(r.sku, [...(reviewsBySku.get(r.sku) ?? []), r]);
  }
  let below = 0, thin = 0, richPositive = 0, richMixed = 0;
  for (const p of products) {
    const rs = reviewsBySku.get(p.id) ?? [];
    const n = rs.length;
    const negShare = n > 0 ? rs.filter((r) => r.rating <= 3).length / n : 0;
    if (n < REVIEW_THRESHOLD) below++;
    else if (n <= 14) thin++;
    else if (negShare >= 0.2) richMixed++;
    else richPositive++;

    // RULES C1/C2 + Summary/reviews cross-check
    const s = summaries[p.id];
    if (!s) {
      fail(`no fallback summary for ${p.id}`);
      continue;
    }
    if (n < REVIEW_THRESHOLD) {
      if (s.status !== "insufficient_reviews" || s.themes.length !== 0) {
        fail(`${p.id} has ${n} reviews (< ${REVIEW_THRESHOLD}) but its summary isn't the honest empty state`);
      }
    } else {
      if (s.status !== "ok" || s.themes.length < 2 || s.themes.length > 3) {
        fail(`${p.id} has ${n} reviews but its summary isn't status 'ok' with 2-3 themes`);
      }
      if (negShare >= 0.2 && !s.themes.some((t) => t.sentiment !== "positive")) {
        fail(`${p.id} is ${(negShare * 100).toFixed(0)}% <=3-star (RULES C2 threshold 20%) but its summary is all-positive`);
      }
    }
  }
  if (richPositive !== 6) fail(`expected 6 rich-positive SKUs, got ${richPositive}`);
  if (richMixed !== 5) fail(`expected 5 rich-mixed SKUs, got ${richMixed}`);
  if (thin !== 3) fail(`expected 3 thin SKUs, got ${thin}`);
  if (below !== 2) fail(`expected 2 below-threshold SKUs, got ${below}`);

  // Inventory: every product has a row covering every offered size.
  for (const p of products) {
    const row = inventory[p.id];
    if (!row) {
      fail(`no inventory row for ${p.id}`);
      continue;
    }
    for (const size of p.sizes) {
      if (!(size in row)) fail(`inventory[${p.id}] missing size ${size}`);
    }
  }
  let lowStockPairs = 0;
  for (const p of products) {
    for (const size of p.sizes) {
      const units = inventory[p.id]?.[size];
      if (units !== undefined && units >= 1 && units <= 2) lowStockPairs++;
    }
  }
  if (lowStockPairs < 3) fail(`expected >=3 low-stock (1-2 unit) pairs, got ${lowStockPairs}`);

  // Size profile: >=2 unsignalled brands, one per category; signalled
  // brands single-category (DECISIONS.md D2).
  const signalByBrand = new Map(sizeProfile.signals.map((s) => [s.brand, s]));
  const allBrands = new Set(products.map((p) => p.brand));
  const unsignalled = allBrands.difference(new Set(signalByBrand.keys()));
  if (unsignalled.size < 2) fail(`expected >=2 unsignalled brands, got ${unsignalled.size}`);
  if (!shirts.some((p) => unsignalled.has(p.brand))) fail("no unsignalled brand in shirts");
  if (!pants.some((p) => unsignalled.has(p.brand))) fail("no unsignalled brand in pants");
  for (const brand of signalByBrand.keys()) {
    const cats = new Set(products.filter((p) => p.brand === brand).map((p) => p.category));
    if (cats.size > 1) fail(`signalled brand "${brand}" spans multiple categories`);
  }

  let outOfStockInRecommended = 0;
  for (const p of products) {
    const sig = signalByBrand.get(p.brand);
    if (sig && inventory[p.id]?.[sig.size] === 0) outOfStockInRecommended++;
  }
  if (outOfStockInRecommended < 2) fail(`expected >=2 SKUs out of stock in their recommended size, got ${outOfStockInRecommended}`);

  // Stock events: deterministic per DATA_MODEL.md, and must target a
  // currently-nonzero size or the scripted "event" is a no-op.
  if (stockEvents.length < 2) fail(`expected >=2 stock events, got ${stockEvents.length}`);
  for (const e of stockEvents) {
    if (!ids.has(e.sku)) fail(`stock event references unknown sku ${e.sku}`);
    if (inventory[e.sku]?.[e.size] === 0) fail(`stock event target ${e.sku}/${e.size} is already 0 — no-op`);
  }
}

// No Myntra URL anywhere under data/ or public/ — RULES A1/A2.
function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}
const TEXT_EXT = new Set([".json", ".md", ".ts", ".svg"]);
for (const dir of [DATA_DIR, path.join(ROOT, "public")]) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!TEXT_EXT.has(path.extname(file))) continue;
    const text = readFileSync(file, "utf8");
    if (/myntassets|myntra\.com/i.test(text)) {
      fail(`RULE A1/A2 VIOLATION: ${path.relative(ROOT, file)} references a Myntra host`);
    }
  }
}

report();

function report(): void {
  if (errors.length) {
    console.error(`validate:data FAILED (${errors.length} issue${errors.length === 1 ? "" : "s"}):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("validate:data OK — all seed files valid, all invariants hold.");
}
