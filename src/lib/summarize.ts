import { ThemeSchema, type Product, type Review, type Summary, type Theme } from "../../data/schema.ts";
import { getFallbackSummary, getProduct } from "./catalog";
import { REVIEW_THRESHOLD, SUMMARY_TIMEOUT_MS } from "./constants";
import { z } from "zod";

// gemini-2.0-flash was retired by Google after this project was originally
// built — confirmed live via a 404 from the API itself ("This model
// models/gemini-2.0-flash is no longer available... use
// models/gemini-3.6-flash"), not a guess. DECISIONS.md D10.
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SAMPLE_CAP = 40;

const SYSTEM_PROMPT = `You extract themes from customer reviews of a clothing product for a comparison screen. A shopper is deciding between this and 2-3 similar items. Return only what the reviews actually support.

Return exactly 2-3 themes as JSON. Each theme: label (max 28 chars, a finding not a slogan), detail (max 110 chars, one sentence of specifics), sentiment (positive/mixed/negative), mentions (how many of the supplied reviews touch it).

Rules: report what is there, including problems. If a meaningful share of reviews raise a downside, one theme must be negative or mixed - a summary that hides known complaints is a failed summary. Prefer specifics a shopper can compare (fabric behaviour after washing, how sizing runs, colour vs. photos, construction) over generic praise. Never invent a detail not present in the reviews. Never mention price, discounts, delivery, or the retailer. Never recommend whether to buy - the shopper decides. Output JSON only.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    themes: {
      type: "ARRAY",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          detail: { type: "STRING" },
          sentiment: { type: "STRING", enum: ["positive", "mixed", "negative"] },
          mentions: { type: "INTEGER" },
        },
        required: ["label", "detail", "sentiment", "mentions"],
      },
    },
  },
  required: ["themes"],
};

// module-scope, survives across requests in a warm lambda — a user
// swiping back and forth across a 4-card deck must not trigger repeat
// LLM calls (ARCHITECTURE §2)
const cache = new Map<string, Summary>();

function insufficientSummary(sku: string, basedOn: number): Summary {
  return { sku, status: "insufficient_reviews", themes: [], source: "fallback", basedOn };
}

function fallbackSummary(sku: string, basedOn: number): Summary {
  const fb = getFallbackSummary(sku);
  if (fb) return { ...fb, basedOn };
  return insufficientSummary(sku, basedOn);
}

/** Preserves the corpus's rating distribution in the sample — if 30% of
 * reviews are 1-3 star, ~30% of the sample is too. Sampling only the most
 * recent reviews is the common bug the skill calls out, since it quietly
 * filters criticism out (reviews tend to get more critical over a
 * product's life as novelty wears off). */
function sampleReviews(reviews: Review[], cap: number): Review[] {
  if (reviews.length <= cap) return reviews;
  const byRating = new Map<number, Review[]>();
  for (const r of reviews) {
    if (!byRating.has(r.rating)) byRating.set(r.rating, []);
    byRating.get(r.rating)!.push(r);
  }
  const fraction = cap / reviews.length;
  const sample: Review[] = [];
  for (const group of byRating.values()) {
    const take = Math.max(1, Math.round(group.length * fraction));
    const step = group.length / take;
    for (let i = 0; i < take; i++) sample.push(group[Math.floor(i * step)]);
  }
  return sample.slice(0, cap);
}

function buildUserPrompt(product: Product, sample: Review[], corrective?: string): string {
  const lines = sample.map((r) => `[${r.rating}] ${r.text}`).join("\n");
  const header = `Category: ${product.category}. Fit: ${product.fit}. Material: ${product.material}.\n\nReviews:\n${lines}`;
  return corrective ? `${header}\n\n${corrective}` : header;
}

const BANNED_PATTERN = /\brecommend|worth it|best buy|₹|\$|\brs\.?\s?\d/i;

function themesAreValid(themes: Theme[], corpusSize: number): boolean {
  if (themes.length < 2 || themes.length > 3) return false;
  for (const t of themes) {
    if (t.label.length > 28 || t.detail.length > 110) return false;
    if (t.mentions > corpusSize) return false;
    if (BANNED_PATTERN.test(t.label) || BANNED_PATTERN.test(t.detail)) return false;
  }
  return true;
}

async function callGemini(systemPrompt: string, userPrompt: string, apiKey: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // gemini-3.6-flash "thinks" (extended internal reasoning) by
          // default — confirmed live, its response carries a
          // thoughtSignature even for this short extractive task — which
          // is most of why real calls were exceeding a 6s/15s timeout.
          // This task needs none of that: it's a bounded extraction over
          // a fixed set of reviews, not open-ended reasoning. Disabling it
          // is a real latency fix, not just a bigger timeout. DECISIONS.md D10.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("Gemini response missing text");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

const RawThemesSchema = z.object({ themes: z.array(ThemeSchema) });

/** review-summarizer skill's post-validation: the prompt alone is not
 * sufficient (RULES C2). Enforced in code after the model returns, with
 * one retry on a corrective instruction, then fallback. */
async function summarizeWithLLM(
  sku: string,
  product: Product,
  reviews: Review[],
  apiKey: string,
): Promise<Summary> {
  const sample = sampleReviews(reviews, SAMPLE_CAP);
  const negShare = reviews.filter((r) => r.rating <= 3).length / reviews.length;

  for (let attempt = 0; attempt < 2; attempt++) {
    const corrective =
      attempt === 0
        ? undefined
        : `Your previous themes did not reflect the negative sentiment present: ${Math.round(negShare * 100)}% of these reviews are rated 3 stars or below. Include at least one negative or mixed theme grounded in the low-rated reviews above.`;
    try {
      const raw = await callGemini(SYSTEM_PROMPT, buildUserPrompt(product, sample, corrective), apiKey);
      const parsed = RawThemesSchema.safeParse(raw);
      if (!parsed.success) continue;
      const themes = parsed.data.themes;

      if (!themesAreValid(themes, reviews.length)) continue;
      const hasNeg = themes.some((t) => t.sentiment !== "positive");
      if (negShare >= 0.2 && !hasNeg) continue; // RULES C2 — retry or fall back, never ship an all-positive summary of a mixed corpus

      return { sku, status: "ok", themes, source: "llm", basedOn: reviews.length };
    } catch (e) {
      console.error(`[summarize] Gemini call failed for ${sku} (attempt ${attempt + 1})`, e);
    }
  }
  console.error(`[summarize] ${sku} fell back after exhausting retries`);
  return fallbackSummary(sku, reviews.length);
}

// TEMPORARY, for src/app/api/debug-gemini/route.ts only — runs the exact
// real prompt/schema/validation path against real review data and returns
// full diagnostics instead of silently falling back, so a live failure can
// be seen instead of guessed at. Delete alongside the debug route.
export async function debugSummarizeAttempt(sku: string, reviews: Review[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  const product = getProduct(sku);
  if (!apiKey || !product) return { error: "missing apiKey or product", hasKey: !!apiKey, hasProduct: !!product };

  const sample = sampleReviews(reviews, SAMPLE_CAP);
  const negShare = reviews.filter((r) => r.rating <= 3).length / reviews.length;
  const userPrompt = buildUserPrompt(product, sample);

  let raw: unknown;
  try {
    raw = await callGemini(SYSTEM_PROMPT, userPrompt, apiKey);
  } catch (e) {
    return { step: "callGemini threw", error: e instanceof Error ? e.message : String(e) };
  }

  const parsed = RawThemesSchema.safeParse(raw);
  if (!parsed.success) {
    return { step: "zod parse failed", raw, zodError: parsed.error.issues };
  }

  const themes = parsed.data.themes;
  const valid = themesAreValid(themes, reviews.length);
  const hasNeg = themes.some((t) => t.sentiment !== "positive");
  const negCheckPassed = !(negShare >= 0.2 && !hasNeg);

  return {
    step: "complete",
    themes,
    themesAreValid: valid,
    negShare,
    hasNeg,
    negCheckPassed,
    wouldSucceed: valid && negCheckPassed,
    themeLengths: themes.map((t) => ({ label: t.label, labelLen: t.label.length, detailLen: t.detail.length })),
  };
}

export async function resolveSummary(sku: string, reviews: Review[]): Promise<Summary> {
  if (reviews.length < REVIEW_THRESHOLD) {
    return insufficientSummary(sku, reviews.length); // RULES C1 — no LLM call, ever
  }

  const cacheKey = `${sku}:${reviews.length}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY;
  const product = getProduct(sku);
  const result =
    apiKey && product
      ? await summarizeWithLLM(sku, product, reviews, apiKey)
      : fallbackSummary(sku, reviews.length);

  cache.set(cacheKey, result);
  return result;
}
