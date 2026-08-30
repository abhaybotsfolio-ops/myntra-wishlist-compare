---
name: review-summarizer
description: Building the /api/summarize route — Gemini prompt, strict JSON contract, the anti-sycophancy validator, threshold handling, caching, timeouts and fallback. Load before writing any LLM code for R5.
---

# review-summarizer

R5 is the only place an LLM does real work in this product. It has one job: turn 30 reviews
into 2–3 findings a shopper can act on, without lying. The interesting engineering is not the
API call — it is everything that stops the model from producing pleasant, useless, uniformly
positive output.

## Contract

```
POST /api/summarize
  { skus: string[] }                  // 2–4 per request, batched at deck open
→ { summaries: Summary[] }            // Summary shape in docs/DATA_MODEL.md
```

Server-side only. `GEMINI_API_KEY` never reaches the client.

## Order of implementation

**Build the fallback path first.** With no key set, `/api/summarize` reads
`summaries.fallback.json` and returns it. Verify the whole app is demoable in that state.
Only then add the live call. Building it the other way round produces a fallback nobody has
ever looked at, which is the one that will be running if the key expires an hour before the
case presentation.

## Threshold gate — before anything else

```ts
if (reviews.length < REVIEW_THRESHOLD)   // 8
  return { sku, status: 'insufficient_reviews', themes: [], source: 'fallback', basedOn: reviews.length };
```

No LLM call. No invented themes. The UI renders "Not enough reviews yet". `ACCEPTANCE.md` 5.5
asserts the SKU never appears in an outbound request, so gate on the server *and* filter the
SKU list on the client before posting.

## Prompt

Model `gemini-2.0-flash` via the plain REST endpoint (`POST
generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=…`) —
call it with `fetch`, no SDK dependency (Phase 0's dependency list is exhaustive). Request
body: `generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }`. That
`responseMimeType` field is Gemini's equivalent of Groq/OpenAI's `response_format: {type:
'json_object'}` — it forces strict JSON back, which the Zod parse still re-validates.

System message, in substance:

> You extract themes from customer reviews of a clothing product for a comparison screen. A
> shopper is deciding between this and 2–3 similar items. Return only what the reviews
> actually support.
>
> Return exactly 2–3 themes as JSON. Each theme: `label` (max 28 chars, a finding not a
> slogan), `detail` (max 110 chars, one sentence of specifics), `sentiment`
> (`positive`/`mixed`/`negative`), `mentions` (how many of the supplied reviews touch it).
>
> Rules: report what is there, including problems. If a meaningful share of reviews raise a
> downside, one theme must be negative or mixed — a summary that hides known complaints is a
> failed summary. Prefer specifics a shopper can compare (fabric behaviour after washing,
> how sizing runs, colour vs. photos, construction) over generic praise. Never invent a
> detail not present in the reviews. Never mention price, discounts, delivery, or the
> retailer. Never recommend whether to buy — the shopper decides. Output JSON only.

User message: the SKU's category, fit and material, then the reviews as
`[rating] text` lines. Cap at 40 reviews sampled to preserve the real rating distribution —
if 30% of the corpus is 1–3★, 30% of the sample must be too. Sampling only the most recent
reviews is a common bug that quietly filters out the criticism.

Ban price commentary in the prompt because the PRD's non-goals rule out discount nudges, and
a model given price context will drift into "great value for money" — which is a
recommendation, violating RULES B3.

## Post-validation — the part that makes it honest

The prompt is not sufficient. Enforce in code after parsing:

```ts
const negShare = reviews.filter(r => r.rating <= 3).length / reviews.length;
const hasNeg   = themes.some(t => t.sentiment !== 'positive');

if (negShare >= 0.20 && !hasNeg) {
  // one retry with a corrective user message naming the share and the low-star reviews
  // still no negative theme → return the fallback summary, log it
}
```

Also reject and fall back on: fewer than 2 or more than 3 themes, `label` over 28 chars,
`detail` over 110, any theme whose `mentions` exceeds the corpus size, JSON that fails Zod,
or any theme containing a currency symbol or the words "recommend", "worth it", "best buy".

Log every rejection reason server-side. If a particular SKU fails repeatedly, that is a signal
your seed reviews are too bland, not that the validator is too strict — fix the data.

## Caching, timeouts, concurrency

- Module-scope `Map<string, Summary>` keyed on `` `${sku}:${reviewCount}` ``. Warm lambdas
  keep it across requests. A user swiping back and forth across four cards must generate zero
  additional calls.
- `AbortController` at **6s** per SKU. On timeout, fall back silently.
- Summarise the batch with `Promise.allSettled`, never sequentially — a 4-card deck must not
  take 4× a single call.
- Prefetch the moment selection is confirmed, during the deck-entry animation. By the time
  card 1 is interactive the first summary is usually resolved.

## Client rendering

Skeleton in the reviews row while pending — fixed height, same as the loaded state, so
nothing shifts (RULES E2). Never a spinner that changes row height. Never an error message: a
failed summarisation renders the fallback and says nothing about it. `source` is recorded in
the `summary_rendered` event for your own debugging and is never displayed.

Show `from 34 reviews` under the theme group. It is the difference between a summary that
reads as evidence and one that reads as copy.

## Cost and rate limits

Gemini's free tier is generous but rate-limited per minute. With caching, a full demo session
is well under 20 calls. If you hit a limit during development, the fallback path absorbs it —
which is the second reason to build that path first.
