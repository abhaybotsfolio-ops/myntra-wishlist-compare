/**
 * One-off authoring tool — NOT part of the shipped app. Run with:
 *   node scripts/generate-seed.ts
 * to (re)produce every file under /data and every image under
 * /public/products. Deterministic (seeded PRNG): re-running it with no
 * source edits reproduces byte-identical review/inventory assignments.
 *
 * catalog-seed skill: "The seed data is not filler... every branch in the
 * PRD needs a SKU that exercises it." This file is where that's built, and
 * where the invariants validate-data.ts checks are actually satisfied from.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type {
  Product,
  Review,
  Inventory,
  SizeProfile,
  StockEvent,
  Summary,
  Theme,
} from "../data/schema.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const IMG_DIR = path.join(ROOT, "public", "products");

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same seed in, same catalog out.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260830); // today's date, arbitrary but fixed

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function shuffledCycle<T>(arr: readonly T[], n: number): T[] {
  // deterministic round-robin with a shuffled starting offset per call,
  // so short pools don't repeat in the same order every time
  const offset = Math.floor(rand() * arr.length);
  return Array.from({ length: n }, (_, i) => arr[(i + offset) % arr.length]);
}
function daysAgoISO(days: number, hourJitter = true): string {
  const base = new Date("2026-08-30T09:00:00Z").getTime();
  const jitter = hourJitter ? Math.floor(rand() * 20 * 3600_000) : 0;
  return new Date(base - days * 86_400_000 - jitter).toISOString();
}

// ---------------------------------------------------------------------------
// 1. Products — 16 SKUs, 9 shirts / 7 pants.
//
// Brand/category exclusivity: every brand that gets a size-profile SIGNAL
// appears in exactly one category. SizeSignal is keyed by brand only (no
// category field — see size-wedge skill's getRecommendedSize(profile,
// brand) signature), and shirts use alpha sizes while pants use numeric
// waist sizes, so a signalled brand spanning both categories would need two
// contradictory "recommended sizes" at once. Keeping signalled brands
// single-category sidesteps that. The two deliberately UNSIGNALLED brands
// (Highlander, WROGN) are exempt from this — see DECISIONS.md D2.
// ---------------------------------------------------------------------------

type Fit = "Slim Fit" | "Regular Fit" | "Relaxed Fit" | "Tapered Fit";
type Material =
  | "100% Cotton"
  | "Cotton Blend"
  | "Linen Blend"
  | "Poly-Viscose"
  | "Stretch Denim";

const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL"];
const PANT_SIZES = ["28", "30", "32", "34", "36", "38"];

interface ProductSeed {
  id: string;
  category: "shirts" | "pants";
  brand: string;
  title: string;
  fit: Fit;
  material: Material;
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  savedAgoDays: number;
}

const PRODUCT_SEEDS: ProductSeed[] = [
  // ---- Shirts (9) ----
  { id: "shirt-roadster-001", category: "shirts", brand: "Roadster", title: "Slim Fit Cotton Casual Shirt", fit: "Slim Fit", material: "100% Cotton", price: 899, mrp: 1799, rating: 4.1, ratingCount: 2841, savedAgoDays: 4 },
  { id: "shirt-roadster-002", category: "shirts", brand: "Roadster", title: "Regular Fit Checked Casual Shirt", fit: "Regular Fit", material: "Cotton Blend", price: 799, mrp: 1599, rating: 3.9, ratingCount: 612, savedAgoDays: 21 },
  { id: "shirt-hereandnow-001", category: "shirts", brand: "HERE&NOW", title: "Relaxed Fit Cotton Poplin Shirt", fit: "Relaxed Fit", material: "100% Cotton", price: 649, mrp: 1299, rating: 3.6, ratingCount: 940, savedAgoDays: 11 },
  { id: "shirt-hereandnow-002", category: "shirts", brand: "HERE&NOW", title: "Tapered Fit Linen Shirt", fit: "Tapered Fit", material: "Linen Blend", price: 1199, mrp: 1999, rating: 4.4, ratingCount: 1523, savedAgoDays: 2 },
  { id: "shirt-vanheusen-001", category: "shirts", brand: "Van Heusen", title: "Regular Fit Formal Shirt", fit: "Regular Fit", material: "Cotton Blend", price: 1499, mrp: 2499, rating: 3.7, ratingCount: 2210, savedAgoDays: 34 },
  { id: "shirt-vanheusen-002", category: "shirts", brand: "Van Heusen", title: "Slim Fit Wrinkle-Free Shirt", fit: "Slim Fit", material: "Poly-Viscose", price: 1599, mrp: 1999, rating: 4.0, ratingCount: 58, savedAgoDays: 1 },
  { id: "shirt-peterengland-001", category: "shirts", brand: "Peter England", title: "Regular Fit Office Formal Shirt", fit: "Regular Fit", material: "Cotton Blend", price: 999, mrp: 1999, rating: 4.3, ratingCount: 3102, savedAgoDays: 45 },
  { id: "shirt-peterengland-002", category: "shirts", brand: "Peter England", title: "Slim Fit Cotton Formal Shirt", fit: "Slim Fit", material: "100% Cotton", price: 779, mrp: 1299, rating: 3.8, ratingCount: 487, savedAgoDays: 8 },
  { id: "shirt-highlander-001", category: "shirts", brand: "Highlander", title: "Slim Fit Printed Casual Shirt", fit: "Slim Fit", material: "Poly-Viscose", price: 499, mrp: 999, rating: 3.5, ratingCount: 1050, savedAgoDays: 15 },
  // ---- Pants (7) ----
  { id: "pants-levis-001", category: "pants", brand: "Levi's", title: "511 Slim Fit Jeans", fit: "Slim Fit", material: "Stretch Denim", price: 3499, mrp: 3499, rating: 4.6, ratingCount: 5230, savedAgoDays: 6 },
  { id: "pants-levis-002", category: "pants", brand: "Levi's", title: "512 Tapered Fit Jeans", fit: "Tapered Fit", material: "Stretch Denim", price: 1799, mrp: 2999, rating: 3.8, ratingCount: 876, savedAgoDays: 27 },
  { id: "pants-uspoloassn-001", category: "pants", brand: "U.S. Polo Assn.", title: "Regular Fit Chino Trousers", fit: "Regular Fit", material: "Cotton Blend", price: 999, mrp: 2299, rating: 4.2, ratingCount: 1680, savedAgoDays: 3 },
  { id: "pants-uspoloassn-002", category: "pants", brand: "U.S. Polo Assn.", title: "Tapered Fit Casual Trousers", fit: "Tapered Fit", material: "Cotton Blend", price: 1199, mrp: 1499, rating: 4.0, ratingCount: 640, savedAgoDays: 18 },
  { id: "pants-allensolly-001", category: "pants", brand: "Allen Solly", title: "Slim Fit Formal Trousers", fit: "Slim Fit", material: "100% Cotton", price: 1299, mrp: 2599, rating: 4.5, ratingCount: 2990, savedAgoDays: 9 },
  { id: "pants-allensolly-002", category: "pants", brand: "Allen Solly", title: "Relaxed Fit Casual Trousers", fit: "Relaxed Fit", material: "Poly-Viscose", price: 749, mrp: 1499, rating: 3.4, ratingCount: 410, savedAgoDays: 40 },
  { id: "pants-wrogn-001", category: "pants", brand: "WROGN", title: "Tapered Fit Joggers", fit: "Tapered Fit", material: "Cotton Blend", price: 1099, mrp: 1999, rating: 3.9, ratingCount: 95, savedAgoDays: 1 },
];

const PRODUCTS: Product[] = PRODUCT_SEEDS.map((p) => ({
  id: p.id,
  category: p.category,
  brand: p.brand,
  title: p.title,
  images: [`/products/${p.id}-1.jpg`, `/products/${p.id}-2.jpg`],
  mrp: p.mrp,
  price: p.price,
  discountPct: Math.round(((p.mrp - p.price) / p.mrp) * 100),
  rating: p.rating,
  ratingCount: p.ratingCount,
  fit: p.fit,
  material: p.material,
  sizes: p.category === "shirts" ? SHIRT_SIZES : PANT_SIZES,
  savedAt: daysAgoISO(p.savedAgoDays),
}));

// ---------------------------------------------------------------------------
// 2. Review content — hand-written per SKU (catalog-seed skill: concrete,
// comparable specifics, never "Nice product. Value for money.").
// ---------------------------------------------------------------------------

type Band = "rich-positive" | "rich-mixed" | "thin" | "below";

interface SkuContent {
  sku: string;
  count: number;
  band: Band;
  positive: string[];
  minor?: string[]; // mild nitpick, rating 3, sentiment "mixed" flavoured
  negative?: string[]; // the primary cluster driving a "negative" theme
}

const CONTENT: SkuContent[] = [
  {
    sku: "shirt-roadster-001",
    count: 30,
    band: "rich-positive",
    positive: [
      "Fabric felt a bit stiff out of the packet but softened nicely after the first wash.",
      "True to size — ordered my usual M and the shoulders sit right.",
      "Colour matches the product photos almost exactly, maybe a shade darker indoors.",
      "Stitching on the collar and cuffs still looks neat after four washes.",
      "Good weight of cotton — not see-through even in bright light.",
      "Sleeve length is right for someone around 5'9\".",
      "Held its shape well, no shrinkage after washing in cold water.",
      "Buttons feel sturdy, not the flimsy plastic kind some shirts have.",
      "Breathable enough for a full day at the office.",
      "Tucks in well without bunching at the waist.",
    ],
    minor: [
      "Slightly boxier through the chest than I expected for a slim fit, but not a dealbreaker.",
      "Takes a bit of ironing to look crisp, otherwise it creases easily.",
    ],
  },
  {
    sku: "shirt-roadster-002",
    count: 9,
    band: "thin",
    positive: [
      "Check pattern lines up neatly at the side seams, which surprised me at this price.",
      "Fits true to size, regular through the body as advertised.",
      "Good for layering under a jacket in winter.",
      "Colours are more muted than the listing photo, in a good way.",
    ],
    minor: ["Fabric is a bit thinner than I'd like for a checked shirt."],
  },
  {
    sku: "shirt-hereandnow-001",
    count: 26,
    band: "rich-mixed",
    negative: [
      "Shoulders are noticeably wider than a normal relaxed fit — looks oversized even in size S.",
      "Ordered my usual size and the shoulder seams sit almost at my upper arm.",
      "Runs big through the shoulders and sleeves; I'd size down if buying again.",
      "Relaxed fit here really means baggy — the shoulder drop is more than I expected.",
      "The shoulder seams hang well past where a shirt seam normally sits.",
    ],
    positive: [
      "Poplin fabric feels crisp and breathable in humid weather.",
      "Colour is exactly as shown online.",
      "Good for a casual weekend look, easy to dress up or down.",
      "Machine washes well without any pilling so far.",
      "Fabric wrinkles within an hour of wearing it, but airs out fine overnight.",
    ],
    minor: ["Slightly see-through in direct sunlight, wear a plain tee underneath."],
  },
  {
    sku: "shirt-hereandnow-002",
    count: 30,
    band: "rich-positive",
    positive: [
      "Linen blend breathes really well, perfect for humid days.",
      "Tapered cut actually tapers — noticeable difference from their relaxed fit shirt.",
      "Colour is a richer shade than the photos, in a nice way.",
      "Sleeves hit right at the wrist, no bunching.",
      "Fabric has a slight texture that photographs well.",
      "True to size for a tapered cut, ordered my regular size.",
      "Held up well after six washes, no fading.",
      "Lightweight enough to wear as an outer layer over a tee.",
    ],
    minor: [
      "Wrinkles are part of the linen look — embrace it rather than fight it.",
      "Creases very easily, needs steaming before wearing out.",
    ],
  },
  {
    sku: "shirt-vanheusen-001",
    count: 26,
    band: "rich-mixed",
    negative: [
      "Colour is noticeably more grey than the blue shown in the product photos.",
      "What looked like a soft blue online arrived closer to a flat grey-blue.",
      "Ordered the light blue and it reads almost slate grey in person.",
      "The photo colour and the actual shirt colour don't quite match — still wearable, just different.",
      "Grey undertone is much stronger in person than in the listing photos.",
    ],
    positive: [
      "Fits well for office wear, regular through the body without being boxy.",
      "Good for tucking in — stays put through a full workday.",
      "Cuffs are well-stitched and hold their shape.",
      "True to size, ordered my usual and it's spot on.",
      "Collar loses its stiffness after a couple of washes, but a light starch fixes it.",
    ],
    minor: ["Fabric is thinner than expected for a formal shirt at this price."],
  },
  {
    sku: "shirt-vanheusen-002",
    count: 3,
    band: "below",
    positive: [
      "Genuinely wrinkle-resistant, wore it on a flight and it still looked pressed.",
      "A bit pricier than their regular line but the fabric feels worth it.",
    ],
    minor: ["Slim through the waist, might feel snug if you're broader."],
  },
  {
    sku: "shirt-peterengland-001",
    count: 30,
    band: "rich-positive",
    positive: [
      "Classic office shirt, fits exactly as expected for a regular fit.",
      "Fabric has a nice subtle sheen without looking shiny or cheap.",
      "Doesn't need much ironing, held a crisp look through a 9-hour workday.",
      "Collar stays structured even after a few washes.",
      "True to size — ordered L, fits like every other L I own.",
      "Good value formal shirt, holds up to weekly wear.",
      "Colour is accurate to the listing photos.",
      "Stitching around the buttons is solid, nothing coming loose after months.",
      "Breathable enough under a blazer.",
    ],
    minor: ["Slightly longer in the body than I expected, fine if you tuck it in."],
  },
  {
    sku: "shirt-peterengland-002",
    count: 9,
    band: "thin",
    positive: [
      "Slim fit is genuinely slim, order a size up if you're not used to fitted shirts.",
      "Cotton feels good quality for the price point.",
      "Colour matches the site photos well.",
      "Good for a fitted formal look without feeling restrictive.",
    ],
    minor: ["Fabric picked up a bit of pilling under the arms after a month of wear."],
  },
  {
    sku: "shirt-highlander-001",
    count: 26,
    band: "rich-mixed",
    negative: [
      "Fabric is quite thin — you can see a vest through it in daylight.",
      "Thinner material than I expected for the price, borderline see-through.",
      "Had to wear a plain tee underneath because the shirt alone felt too sheer.",
      "Print is nice but the base fabric feels flimsy compared to their plain shirts.",
      "Material is on the thin side, doesn't feel like it'll last many seasons.",
    ],
    positive: [
      "Print design looks exactly like the photos, good colour accuracy.",
      "Fits true to size for a slim cut.",
      "Good for casual outings, gets compliments on the print.",
      "Lightweight, good for warm weather.",
      "Print held up fine through the first few washes.",
    ],
    minor: ["Buttons feel a bit loose, one came off within a month."],
  },
  {
    sku: "pants-levis-001",
    count: 32,
    band: "rich-positive",
    positive: [
      "Classic 511 fit, exactly like the pair I already own from a store.",
      "Stretch denim moves with you, comfortable for a full day of walking.",
      "True to size across the waist and length, no surprises.",
      "Colour is a deep indigo that hasn't faded much after a dozen washes.",
      "Stitching and rivets feel like the real deal, no complaints on build quality.",
      "Tapered through the leg without being tight at the ankle.",
      "Held up well after a year of regular wear.",
      "Waistband doesn't dig in even after sitting for long stretches.",
      "Worth the price for the fit alone.",
    ],
    minor: ["A little stiff for the first two or three wears, then it breaks in nicely."],
  },
  {
    sku: "pants-levis-002",
    count: 26,
    band: "rich-mixed",
    negative: [
      "Waist runs small — I sized up to 34 from my usual 32 and it's right.",
      "True to length but the waist measurement felt tighter than the size tag suggests.",
      "Had to exchange for a size up after the waist ran noticeably small.",
      "Sizing runs small around the waist compared to their 511 fit.",
      "Waist is snugger than expected, factor that in when ordering.",
    ],
    positive: [
      "Tapered leg looks great with boots or sneakers.",
      "Denim quality feels consistent with their other jeans.",
      "Colour is true to the listing.",
      "Comfortable stretch once you get the right size.",
      "Ankle opening is tighter than shown in the product photos, in a good way for a tapered look.",
    ],
  },
  {
    sku: "pants-uspoloassn-001",
    count: 30,
    band: "rich-positive",
    positive: [
      "Good everyday chino, holds a crease well.",
      "True to size through the waist and thigh.",
      "Fabric is a nice mid-weight, not too heavy for summer.",
      "Colour is accurate to the photos.",
      "Comfortable for a full workday, no bunching behind the knee.",
      "Stitching along the pockets looks durable.",
      "Good value at this price point.",
      "Waistband has just enough stretch for comfort.",
    ],
    minor: ["Runs slightly long, had them hemmed by an inch."],
  },
  {
    sku: "pants-uspoloassn-002",
    count: 9,
    band: "thin",
    positive: [
      "Tapered cut looks sharp without being skinny.",
      "Fabric has a slight stretch, comfortable for daily wear.",
      "True to size, ordered my regular waist.",
      "Good for smart-casual outings.",
    ],
    minor: ["Colour is a touch darker than shown online."],
  },
  {
    sku: "pants-allensolly-001",
    count: 30,
    band: "rich-positive",
    positive: [
      "Sharp slim fit without feeling restrictive when seated.",
      "Fabric has a nice drape, doesn't wrinkle easily through a workday.",
      "True to size across waist and length.",
      "Colour is accurate, a proper charcoal, not too black or too grey.",
      "Good stitching on the pockets and waistband.",
      "Comfortable for long meetings, no digging at the waist.",
      "Holds a crease well after ironing.",
      "Great value for formal trousers at this price.",
    ],
    minor: ["A little snug through the thigh if you're used to a regular fit."],
  },
  {
    sku: "pants-allensolly-002",
    count: 26,
    band: "rich-mixed",
    negative: [
      "Colour faded noticeably after just a handful of washes.",
      "Washed it on cold and it still lost some of its original shade within a month.",
      "Went from a deep olive to a washed-out green after regular wear.",
      "Colour isn't as fade-resistant as their formal trousers line.",
      "Noticed the colour fading faster than any other trousers I own.",
    ],
    positive: [
      "Relaxed fit is genuinely comfortable for weekend wear.",
      "True to size, roomy without looking baggy.",
      "Good for travel days, doesn't wrinkle much.",
      "Price is fair for the comfort level.",
      "Fabric pills a little at the inner thigh from friction, otherwise holding up.",
    ],
  },
  {
    sku: "pants-wrogn-001",
    count: 4,
    band: "below",
    positive: [
      "Comfortable joggers for casual wear, good stretch at the waistband.",
      "Tapered ankle looks neat with sneakers.",
    ],
    minor: ["Fabric is soft but pills a bit after a few washes."],
  },
];

// ---------------------------------------------------------------------------
// 3. Expand each SKU's content pool into the exact review count for its
// band, controlling the ≤3★ share directly (RULES C2 needs ≥20%; the
// catalog-seed skill targets ≥30% for the mixed band, so we aim higher
// still for margin) rather than leaving it to chance.
// ---------------------------------------------------------------------------

const REVIEWS: Review[] = [];

for (const c of CONTENT) {
  const product = PRODUCT_SEEDS.find((p) => p.id === c.sku)!;
  const sizes = product.category === "shirts" ? SHIRT_SIZES : PANT_SIZES;
  const rows: { text: string; rating: number }[] = [];

  if (c.band === "rich-mixed") {
    const negCount = Math.max(Math.ceil(c.count * 0.35), c.negative!.length);
    const negTexts = shuffledCycle(c.negative!, negCount);
    for (const text of negTexts) rows.push({ text, rating: pick([1, 2, 3, 3]) });

    const minorCount = c.minor ? Math.ceil(c.count * 0.12) : 0;
    if (c.minor) {
      for (const text of shuffledCycle(c.minor, minorCount)) {
        rows.push({ text, rating: 3 });
      }
    }
    const remaining = c.count - rows.length;
    for (const text of shuffledCycle(c.positive, Math.max(remaining, 0))) {
      rows.push({ text, rating: pick([4, 4, 5]) });
    }
  } else {
    // rich-positive, thin, below: mostly positive, a light sprinkle of
    // "minor" (rating 3) for texture, always comfortably under the 20%
    // mixed-sentiment threshold so RULES C2 doesn't (and shouldn't) fire.
    const minorCount = c.minor ? Math.min(c.minor.length, Math.max(1, Math.floor(c.count * 0.1))) : 0;
    if (c.minor) {
      for (const text of shuffledCycle(c.minor, minorCount)) {
        rows.push({ text, rating: 3 });
      }
    }
    const remaining = c.count - rows.length;
    for (const text of shuffledCycle(c.positive, Math.max(remaining, 0))) {
      rows.push({ text, rating: pick([4, 4, 5, 5]) });
    }
  }

  // trim/pad to the exact target count (shuffledCycle already hits it in
  // practice, this is just a safety net) and shuffle row order
  while (rows.length > c.count) rows.pop();
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  rows.forEach((row, i) => {
    REVIEWS.push({
      id: `${c.sku}-r${i + 1}`,
      sku: c.sku,
      rating: row.rating,
      text: row.text,
      size: rand() < 0.75 ? pick(sizes) : undefined,
      verified: rand() < 0.85,
      date: daysAgoISO(3 + Math.floor(rand() * 150)),
    });
  });
}

// ---------------------------------------------------------------------------
// 4. Fallback summaries — hand-defined themes per above-threshold SKU,
// `mentions` computed for real by matching against the reviews just built
// (review-summarizer skill: "so mentions counts are real rather than
// invented" — same standard applies to the fallback, not only the LLM).
// ---------------------------------------------------------------------------

interface ThemeDef {
  label: string;
  detail: string;
  sentiment: Theme["sentiment"];
  keywords: string[];
}

const THEME_DEFS: Record<string, ThemeDef[]> = {
  "shirt-roadster-001": [
    { label: "Softens after first wash", sentiment: "positive", keywords: ["soften"], detail: "Feels stiff out of the pack but several buyers say it softens after the first wash." },
    { label: "True to size", sentiment: "positive", keywords: ["true to size"], detail: "Runs true to size through the shoulders and body for most reviewers." },
    { label: "Boxier than expected", sentiment: "mixed", keywords: ["boxier"], detail: "A few reviewers found it boxier through the chest than a slim fit suggests." },
  ],
  "shirt-roadster-002": [
    { label: "Checks line up neatly", sentiment: "positive", keywords: ["line up"], detail: "The check pattern lines up cleanly at the seams, better finish than the price implies." },
    { label: "Fabric on the thin side", sentiment: "mixed", keywords: ["thinner"], detail: "A couple of buyers wanted a heavier weave for a checked shirt." },
  ],
  "shirt-hereandnow-001": [
    { label: "Shoulders run large", sentiment: "negative", keywords: ["shoulder"], detail: "Multiple buyers report the shoulder seams sitting well past where they expect, even sized down." },
    { label: "Poplin breathes well", sentiment: "positive", keywords: ["breath"], detail: "The poplin weave holds up in humid weather according to several reviewers." },
  ],
  "shirt-hereandnow-002": [
    { label: "Breathes well in humidity", sentiment: "positive", keywords: ["breath"], detail: "The linen blend is repeatedly called out as comfortable in humid weather." },
    { label: "Tapered cut actually tapers", sentiment: "positive", keywords: ["taper"], detail: "Reviewers note a real difference from the brand's relaxed-fit shirts." },
    { label: "Wrinkles like linen does", sentiment: "mixed", keywords: ["wrinkle", "crease"], detail: "Some buyers flag it creases quickly and needs steaming before wearing out." },
  ],
  "shirt-vanheusen-001": [
    { label: "Runs greyer than photos", sentiment: "negative", keywords: ["grey"], detail: "Several buyers say the blue reads noticeably greyer in person than in the listing photos." },
    { label: "Fits well for office wear", sentiment: "positive", keywords: ["office"], detail: "Regular fit through the body works well for a full office day, per multiple reviews." },
  ],
  "shirt-peterengland-001": [
    { label: "Holds a crisp look all day", sentiment: "positive", keywords: ["crisp"], detail: "Reviewers say it stays crisp through a full workday with minimal ironing." },
    { label: "True to size", sentiment: "positive", keywords: ["true to size"], detail: "Consistently fits as expected for a regular fit, per multiple reviewers." },
    { label: "Slightly long in the body", sentiment: "mixed", keywords: ["longer in the body"], detail: "A few buyers found it longer in the body than expected — fine tucked in." },
  ],
  "shirt-peterengland-002": [
    { label: "Genuinely slim fit", sentiment: "positive", keywords: ["genuinely slim"], detail: "Reviewers confirm the slim fit runs true — size up if you're not used to fitted shirts." },
    { label: "Some pilling under the arms", sentiment: "mixed", keywords: ["pilling"], detail: "At least one buyer noticed pilling under the arms after a month of wear." },
  ],
  "shirt-highlander-001": [
    { label: "Fabric runs sheer", sentiment: "negative", keywords: ["thin", "sheer"], detail: "Multiple buyers say the fabric is thin enough to need a plain tee underneath." },
    { label: "Print matches the photos", sentiment: "positive", keywords: ["print"], detail: "The printed design is repeatedly described as true to the listing photos." },
  ],
  "pants-levis-001": [
    { label: "Classic 511 fit as expected", sentiment: "positive", keywords: ["511"], detail: "Reviewers confirm it matches the familiar 511 fit from other Levi's purchases." },
    { label: "Stretch moves with you", sentiment: "positive", keywords: ["stretch denim"], detail: "The stretch denim is repeatedly called comfortable for a full day of walking." },
    { label: "Stiff for first few wears", sentiment: "mixed", keywords: ["stiff"], detail: "A few buyers note it takes two or three wears to break in." },
  ],
  "pants-levis-002": [
    { label: "Waist runs small", sentiment: "negative", keywords: ["waist"], detail: "Several buyers sized up after finding the waist noticeably tighter than the tag." },
    { label: "Tapered leg pairs well", sentiment: "positive", keywords: ["tapered leg"], detail: "The tapered leg is called a good match for boots or sneakers." },
  ],
  "pants-uspoloassn-001": [
    { label: "Holds a crease well", sentiment: "positive", keywords: ["crease"], detail: "Reviewers say it holds a crease through a full workday." },
    { label: "True to size", sentiment: "positive", keywords: ["true to size"], detail: "Fits true through the waist and thigh for most reviewers." },
    { label: "Runs slightly long", sentiment: "mixed", keywords: ["runs slightly long"], detail: "A few buyers had it hemmed after finding the length slightly long." },
  ],
  "pants-uspoloassn-002": [
    { label: "Sharp tapered cut", sentiment: "positive", keywords: ["tapered cut"], detail: "Called sharp-looking without going skinny by more than one reviewer." },
    { label: "Colour a touch darker", sentiment: "mixed", keywords: ["darker"], detail: "At least one buyer found the colour a shade darker than shown online." },
  ],
  "pants-allensolly-001": [
    { label: "Good drape, low wrinkling", sentiment: "positive", keywords: ["drape"], detail: "Reviewers note it drapes well and resists wrinkling through a workday." },
    { label: "True to size", sentiment: "positive", keywords: ["true to size"], detail: "Fits true across waist and length for most buyers." },
    { label: "Snug through the thigh", sentiment: "mixed", keywords: ["thigh"], detail: "A few reviewers used to a regular fit found it snug through the thigh." },
  ],
  "pants-allensolly-002": [
    { label: "Colour fades fast", sentiment: "negative", keywords: ["fad"], detail: "Multiple buyers report visible fading within the first few washes." },
    { label: "Comfortable relaxed fit", sentiment: "positive", keywords: ["comfortable"], detail: "Reviewers consistently call the relaxed fit comfortable for weekend wear." },
  ],
};

function countMentions(sku: string, keywords: string[]): number {
  const lower = keywords.map((k) => k.toLowerCase());
  return REVIEWS.filter(
    (r) => r.sku === sku && lower.some((k) => r.text.toLowerCase().includes(k)),
  ).length;
}

const REVIEW_THRESHOLD = 8;
const summaries: Record<string, Summary> = {};

for (const c of CONTENT) {
  if (c.band === "below") {
    summaries[c.sku] = {
      sku: c.sku,
      status: "insufficient_reviews",
      themes: [],
      source: "fallback",
      basedOn: c.count,
    };
    continue;
  }
  const defs = THEME_DEFS[c.sku];
  if (!defs) throw new Error(`No THEME_DEFS for ${c.sku}`);
  const themes: Theme[] = defs.map((d) => ({
    label: d.label,
    detail: d.detail,
    sentiment: d.sentiment,
    mentions: Math.max(countMentions(c.sku, d.keywords), 1),
  }));
  summaries[c.sku] = {
    sku: c.sku,
    status: "ok",
    themes,
    source: "fallback",
    basedOn: c.count,
  };
}

// mixed-band SKUs must carry a negative/mixed theme (RULES C2) — assert it
// at authoring time rather than discovering it in a Playwright failure.
for (const c of CONTENT.filter((c) => c.band === "rich-mixed")) {
  const s = summaries[c.sku];
  if (!s.themes.some((t) => t.sentiment !== "positive")) {
    throw new Error(`${c.sku} is rich-mixed but its fallback summary is all-positive`);
  }
  const negShare = REVIEWS.filter((r) => r.sku === c.sku && r.rating <= 3).length / c.count;
  if (negShare < 0.2) {
    throw new Error(`${c.sku} is rich-mixed but only ${(negShare * 100).toFixed(0)}% of reviews are <=3 stars`);
  }
}

// label/detail length assertions — Theme.label <= 28, Theme.detail <= 110
for (const [sku, defs] of Object.entries(THEME_DEFS)) {
  for (const d of defs) {
    if (d.label.length > 28) throw new Error(`${sku} theme label too long (${d.label.length}): "${d.label}"`);
    if (d.detail.length > 110) throw new Error(`${sku} theme detail too long (${d.detail.length}): "${d.detail}"`);
  }
}

// ---------------------------------------------------------------------------
// 5. Size profile — 7 signalled brands (single-category each, see §1
// comment), 2 deliberately unsignalled: Highlander (shirts), WROGN (pants).
// ---------------------------------------------------------------------------

const SIZE_PROFILE: SizeProfile = {
  defaultShirtSize: "M",
  defaultPantSize: "32",
  signals: [
    { brand: "Roadster", size: "M", confidence: "high", source: "past_purchase", basis: "You bought M in Roadster twice" },
    { brand: "HERE&NOW", size: "S", confidence: "medium", source: "stated_preference", basis: "You said you prefer a snugger fit in HERE&NOW" },
    { brand: "Van Heusen", size: "L", confidence: "high", source: "past_purchase", basis: "You bought L in Van Heusen last month" },
    { brand: "Peter England", size: "M", confidence: "medium", source: "past_return", basis: "You returned L in Peter England as too loose" },
    { brand: "Levi's", size: "32", confidence: "high", source: "past_purchase", basis: "You bought 32 in Levi's twice" },
    { brand: "U.S. Polo Assn.", size: "34", confidence: "medium", source: "past_return", basis: "You returned 32 in U.S. Polo Assn. as too tight" },
    { brand: "Allen Solly", size: "32", confidence: "high", source: "stated_preference", basis: "You said 32 fits you best in Allen Solly" },
  ],
};

const SIGNAL_BY_BRAND = new Map(SIZE_PROFILE.signals.map((s) => [s.brand, s]));

// ---------------------------------------------------------------------------
// 6. Inventory — most sizes comfortably stocked; >=3 low-stock (1-2 unit)
// pairs; >=2 SKUs already out of stock in the *recommended* size so R4's
// unavailable branch is visible without waiting for the scripted event.
// ---------------------------------------------------------------------------

const INVENTORY: Inventory = {};
for (const p of PRODUCT_SEEDS) {
  const sizes = p.category === "shirts" ? SHIRT_SIZES : PANT_SIZES;
  const row: Record<string, number> = {};
  for (const size of sizes) row[size] = 6 + Math.floor(rand() * 30);
  INVENTORY[p.id] = row;
}

// >= 3 low-stock (1-2 units) pairs, spread across the catalog
INVENTORY["shirt-roadster-002"]["L"] = 2;
INVENTORY["shirt-hereandnow-002"]["XL"] = 1;
INVENTORY["pants-uspoloassn-001"]["36"] = 2;
INVENTORY["pants-allensolly-001"]["30"] = 1;

// >= 2 (we seed 3) SKUs out of stock in their brand's recommended size —
// pick signalled-brand SKUs and zero exactly that size.
const OUT_OF_STOCK_IN_RECOMMENDED: [string, string][] = [
  ["shirt-roadster-001", "M"], // Roadster -> M
  ["shirt-vanheusen-001", "L"], // Van Heusen -> L
  ["pants-levis-001", "32"], // Levi's -> 32
];
for (const [sku, size] of OUT_OF_STOCK_IN_RECOMMENDED) {
  INVENTORY[sku][size] = 0;
}

// ---------------------------------------------------------------------------
// 7. Stock events — deterministic, target signalled brands' recommended
// sizes on SKUs currently *available* at seed time, so the scripted event
// is the moment it flips (not already-zero from the block above).
// ---------------------------------------------------------------------------

const STOCK_EVENTS: StockEvent[] = [
  { atMs: 15000, sku: "shirt-hereandnow-002", size: "S", newUnits: 0, condition: "sku_in_active_deck" }, // HERE&NOW -> S
  { atMs: 40000, sku: "pants-allensolly-001", size: "32", newUnits: 0, condition: "sku_in_active_deck" }, // Allen Solly -> 32
];
// sanity: these must currently be in stock so the event is a visible drop
for (const e of STOCK_EVENTS) {
  if (INVENTORY[e.sku][e.size] === 0) {
    throw new Error(`stock event target ${e.sku}/${e.size} is already 0 — event would be a no-op`);
  }
}

// ---------------------------------------------------------------------------
// 8. Invariant assertions — the things ACCEPTANCE.md and the acceptance
// tests actually depend on. Fail loudly (RULES F4) rather than drift.
// ---------------------------------------------------------------------------

function assertInvariants() {
  const errors: string[] = [];
  const shirts = PRODUCTS.filter((p) => p.category === "shirts");
  const pants = PRODUCTS.filter((p) => p.category === "pants");
  if (shirts.length !== 9) errors.push(`expected 9 shirts, got ${shirts.length}`);
  if (pants.length !== 7) errors.push(`expected 7 pants, got ${pants.length}`);

  const prices = PRODUCTS.map((p) => p.price);
  if (Math.min(...prices) > 550) errors.push(`min price ${Math.min(...prices)} is not close to the ~499 floor`);
  if (Math.max(...prices) < 3000) errors.push(`max price ${Math.max(...prices)} is not close to the ~3499 ceiling`);
  for (const cat of ["shirts", "pants"] as const) {
    const catPrices = PRODUCTS.filter((p) => p.category === cat).map((p) => p.price).sort((a, b) => a - b);
    const minGap = Math.min(...catPrices.slice(1).map((p, i) => p - catPrices[i]));
    if (minGap > 150) errors.push(`no in-category close price pair (<=150) in ${cat}, min gap was ${minGap}`);
  }

  const ratings = PRODUCTS.map((p) => p.rating);
  if (Math.max(...ratings) - Math.min(...ratings) < 1.0) errors.push("rating spread under 1.0 — too clustered");

  const bandCounts = { "rich-positive": 0, "rich-mixed": 0, thin: 0, below: 0 } as Record<Band, number>;
  for (const c of CONTENT) bandCounts[c.band]++;
  if (bandCounts["rich-positive"] !== 6) errors.push(`expected 6 rich-positive SKUs, got ${bandCounts["rich-positive"]}`);
  if (bandCounts["rich-mixed"] !== 5) errors.push(`expected 5 rich-mixed SKUs, got ${bandCounts["rich-mixed"]}`);
  if (bandCounts.thin !== 3) errors.push(`expected 3 thin SKUs, got ${bandCounts.thin}`);
  if (bandCounts.below !== 2) errors.push(`expected 2 below-threshold SKUs, got ${bandCounts.below}`);

  for (const c of CONTENT) {
    const n = REVIEWS.filter((r) => r.sku === c.sku).length;
    if (n !== c.count) errors.push(`${c.sku} expected ${c.count} reviews, got ${n}`);
    if (c.band === "below" && n >= REVIEW_THRESHOLD) errors.push(`${c.sku} is below-threshold band but has ${n} >= ${REVIEW_THRESHOLD} reviews`);
    if (c.band !== "below" && n < REVIEW_THRESHOLD) errors.push(`${c.sku} is above-threshold band but has ${n} < ${REVIEW_THRESHOLD} reviews`);
  }

  const unsignalledBrands = new Set(PRODUCTS.map((p) => p.brand)).difference(new Set(SIGNAL_BY_BRAND.keys()));
  if (unsignalledBrands.size < 2) errors.push(`expected >=2 unsignalled brands, got ${unsignalledBrands.size}`);
  const unsignalledShirt = shirts.some((p) => unsignalledBrands.has(p.brand));
  const unsignalledPants = pants.some((p) => unsignalledBrands.has(p.brand));
  if (!unsignalledShirt) errors.push("no unsignalled brand present in shirts");
  if (!unsignalledPants) errors.push("no unsignalled brand present in pants");
  for (const brand of SIGNAL_BY_BRAND.keys()) {
    const cats = new Set(PRODUCTS.filter((p) => p.brand === brand).map((p) => p.category));
    if (cats.size > 1) errors.push(`signalled brand "${brand}" spans multiple categories — ambiguous recommended size`);
  }

  let lowStockPairs = 0;
  let outOfStockInRecommended = 0;
  for (const p of PRODUCTS) {
    for (const size of p.sizes) {
      const units = INVENTORY[p.id][size];
      if (units >= 1 && units <= 2) lowStockPairs++;
    }
    const sig = SIGNAL_BY_BRAND.get(p.brand);
    if (sig && INVENTORY[p.id][sig.size] === 0) outOfStockInRecommended++;
  }
  if (lowStockPairs < 3) errors.push(`expected >=3 low-stock (1-2 unit) pairs, got ${lowStockPairs}`);
  if (outOfStockInRecommended < 2) errors.push(`expected >=2 SKUs out of stock in their recommended size, got ${outOfStockInRecommended}`);

  if (errors.length) {
    throw new Error("Seed invariant check failed:\n  " + errors.join("\n  "));
  }
  console.log("All seed invariants satisfied:");
  console.log(`  16 products (9 shirts / 7 pants), price ${Math.min(...prices)}-${Math.max(...prices)}, rating ${Math.min(...ratings)}-${Math.max(...ratings)}`);
  console.log(`  review bands: ${JSON.stringify(bandCounts)}, total reviews: ${REVIEWS.length}`);
  console.log(`  unsignalled brands: ${[...unsignalledBrands].join(", ")}`);
  console.log(`  low-stock pairs: ${lowStockPairs}, out-of-stock-in-recommended: ${outOfStockInRecommended}`);
}

assertInvariants();

// ---------------------------------------------------------------------------
// 9. Product imagery — deterministic SVG flat-lays, rasterized to JPEG.
// See DECISIONS.md D3 for why these are generated rather than sourced.
// ---------------------------------------------------------------------------

const PALETTE: Record<string, { bg: string; fg: string; line: string }> = {
  "shirt-roadster-001": { bg: "#dfe7ea", fg: "#8fa3ab", line: "#5c7078" },
  "shirt-roadster-002": { bg: "#e6e1d6", fg: "#b3a688", line: "#7d7255" },
  "shirt-hereandnow-001": { bg: "#e3ece6", fg: "#9bbcaa", line: "#5f8571" },
  "shirt-hereandnow-002": { bg: "#efe6d8", fg: "#cdb48d", line: "#8d7350" },
  "shirt-vanheusen-001": { bg: "#dde3ec", fg: "#93a6c2", line: "#546b8f" },
  "shirt-vanheusen-002": { bg: "#e6eaef", fg: "#a3b3c7", line: "#5b6d84" },
  "shirt-peterengland-001": { bg: "#e8e6ea", fg: "#b3a9bd", line: "#6f6480" },
  "shirt-peterengland-002": { bg: "#eae7e1", fg: "#c2b6a4", line: "#83725c" },
  "shirt-highlander-001": { bg: "#f0e4dd", fg: "#d9a98f", line: "#a2694f" },
  "pants-levis-001": { bg: "#dbe2ea", fg: "#5c7a9e", line: "#33465c" },
  "pants-levis-002": { bg: "#dde6ec", fg: "#6a86a3", line: "#3c5164" },
  "pants-uspoloassn-001": { bg: "#e7e2d5", fg: "#b8a67e", line: "#7a6a45" },
  "pants-uspoloassn-002": { bg: "#e2e5df", fg: "#9aa88c", line: "#5f6b4f" },
  "pants-allensolly-001": { bg: "#e1e2e4", fg: "#8b8e93", line: "#4d5054" },
  "pants-allensolly-002": { bg: "#e6e6d9", fg: "#a9ab84", line: "#6c6e4f" },
  "pants-wrogn-001": { bg: "#e3e6ea", fg: "#98a5b3", line: "#5a6674" },
};

// Single closed outline, traced clockwise from the left shoulder, so the
// torso/collar/sleeves/cuffs are one coherent silhouette rather than
// separate shapes that have to line up by accident.
const SHIRT_OUTLINE: Array<[number, number]> = [
  [-65, -130], // left shoulder
  [-22, -130], // neck left
  [0, -102], // collar notch
  [22, -130], // neck right
  [65, -130], // right shoulder
  [150, -95], // right sleeve top-outer
  [176, -18], // right cuff outer
  [134, -2], // right cuff inner
  [70, -68], // right underarm
  [88, 242], // hem right (slight flare from underarm)
  [-88, 242], // hem left
  [-70, -68], // left underarm
  [-134, -2], // left cuff inner
  [-176, -18], // left cuff outer
  [-150, -95], // left sleeve top-outer
];
const pointsAttr = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${x},${y}`).join(" ");

function shirtSvg(brand: string, title: string, colors: { bg: string; fg: string; line: string }, crop: "full" | "detail"): string {
  const { bg, fg, line } = colors;
  const buttonYs = [-55, 5, 65, 125, 185];
  const full = `
    <rect width="600" height="800" fill="${bg}"/>
    <g transform="translate(300,330)">
      <polygon points="${pointsAttr(SHIRT_OUTLINE)}" fill="${fg}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>
      <line x1="0" y1="-102" x2="0" y2="240" stroke="${line}" stroke-width="2.5" stroke-dasharray="2 10"/>
      ${buttonYs.map((y) => `<circle cx="0" cy="${y}" r="4.5" fill="${line}"/>`).join("")}
      <rect x="-52" y="0" width="40" height="52" rx="4" fill="none" stroke="${line}" stroke-width="2.5" opacity="0.6"/>
    </g>`;
  // Detail crop: zoom on the collar/placket/pocket only. Scale is chosen
  // from the vertical span we want visible (collar to just past the
  // pocket); the sleeves overflow the canvas width at this scale and get
  // clipped by the SVG viewBox, same as a tightly cropped product photo.
  const svgBody = crop === "full"
    ? full
    : `<rect width="600" height="800" fill="${bg}"/>
       <g transform="translate(300,414) scale(2.6)">
         <polygon points="${pointsAttr(SHIRT_OUTLINE)}" fill="${fg}" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/>
         <line x1="0" y1="-102" x2="0" y2="240" stroke="${line}" stroke-width="1.3" stroke-dasharray="1.5 6"/>
         <circle cx="0" cy="-55" r="2.8" fill="${line}"/>
         <circle cx="0" cy="5" r="2.8" fill="${line}"/>
         <rect x="-52" y="0" width="40" height="52" rx="4" fill="none" stroke="${line}" stroke-width="1.6" opacity="0.6"/>
       </g>`;
  return svgWrap(svgBody, brand, title);
}

function pantsSvg(brand: string, title: string, colors: { bg: string; fg: string; line: string }, crop: "full" | "detail"): string {
  const { bg, fg, line } = colors;
  const full = `
    <rect width="600" height="800" fill="${bg}"/>
    <g transform="translate(300,340)">
      <path d="M -110,-160 L 110,-160 L 118,-110 L 12,-110 L 45,270 L 5,270 L 0,-60 L -5,270 L -45,270 L -12,-110 L -118,-110 Z" fill="${fg}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>
      <rect x="-110" y="-172" width="220" height="24" rx="10" fill="${fg}" stroke="${line}" stroke-width="4"/>
      <rect x="-14" y="-160" width="28" height="30" rx="3" fill="none" stroke="${line}" stroke-width="2.5" opacity="0.7"/>
      <rect x="-96" y="-150" width="10" height="20" rx="2" fill="${line}" opacity="0.5"/>
      <rect x="86" y="-150" width="10" height="20" rx="2" fill="${line}" opacity="0.5"/>
    </g>`;
  // Detail crop: waistband, fly and belt loops only, legs cropped off
  // below. See shirtSvg's detail comment for why the transform is derived
  // this way rather than reusing the full-shot numbers.
  const svgBody = crop === "full"
    ? full
    : `<rect width="600" height="800" fill="${bg}"/>
       <g transform="translate(300,466) scale(2.3)">
         <path d="M -110,-160 L 110,-160 L 118,-110 L 12,-110 L 45,270 L 5,270 L 0,-60 L -5,270 L -45,270 L -12,-110 L -118,-110 Z" fill="${fg}" stroke="${line}" stroke-width="1.8" stroke-linejoin="round"/>
         <rect x="-110" y="-172" width="220" height="24" rx="10" fill="${fg}" stroke="${line}" stroke-width="2.2"/>
         <rect x="-14" y="-160" width="28" height="30" rx="3" fill="none" stroke="${line}" stroke-width="1.6" opacity="0.7"/>
         <rect x="-96" y="-150" width="10" height="20" rx="2" fill="${line}" opacity="0.5"/>
         <rect x="86" y="-150" width="10" height="20" rx="2" fill="${line}" opacity="0.5"/>
       </g>`;
  return svgWrap(svgBody, brand, title);
}

function svgWrap(body: string, brand: string, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    ${body}
    <text x="40" y="740" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="0.5" fill="#282c3f">${escapeXml(brand.toUpperCase())}</text>
    <text x="40" y="770" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="20" fill="#535766">${escapeXml(title)}</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function generateImages() {
  mkdirSync(IMG_DIR, { recursive: true });
  const credits: string[] = [
    "# Product imagery credits",
    "",
    "Every image in this folder is a **generated placeholder** — a deterministic SVG",
    "flat-lay silhouette (garment shape, brand name, product title), rasterized to JPEG.",
    "None of it is sourced photography. See DECISIONS.md D3 for why, and",
    "docs/BUILD_PLAN.md Phase 2 for how to swap in real Unsplash/Pexels photography",
    "later without touching any other file — only the files in this folder change.",
    "",
    "No attribution is owed because nothing here is a third-party work.",
    "",
  ];

  for (const p of PRODUCT_SEEDS) {
    const colors = PALETTE[p.id];
    const build = p.category === "shirts" ? shirtSvg : pantsSvg;
    const variants: Array<["1" | "2", "full" | "detail"]> = [["1", "full"], ["2", "detail"]];
    for (const [n, crop] of variants) {
      const svg = build(p.brand, p.title, colors, crop);
      const outPath = path.join(IMG_DIR, `${p.id}-${n}.jpg`);
      await sharp(Buffer.from(svg))
        .resize(800, 1067)
        .jpeg({ quality: 80 })
        .toFile(outPath);
    }
    credits.push(`- \`${p.id}-1.jpg\`, \`${p.id}-2.jpg\` — generated placeholder (${p.brand})`);
  }

  writeFileSync(path.join(IMG_DIR, "CREDITS.md"), credits.join("\n") + "\n");
  console.log(`Wrote ${PRODUCT_SEEDS.length * 2} images to ${IMG_DIR}`);
}

// ---------------------------------------------------------------------------
// 10. Write everything.
// ---------------------------------------------------------------------------

function writeJson(name: string, data: unknown) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote data/${name}`);
}

writeJson("products.json", PRODUCTS);
writeJson("reviews.json", REVIEWS);
writeJson("inventory.json", INVENTORY);
writeJson("size-profile.json", SIZE_PROFILE);
writeJson("stock-events.json", STOCK_EVENTS);
writeJson("summaries.fallback.json", summaries);

await generateImages();
console.log("Seed generation complete.");
