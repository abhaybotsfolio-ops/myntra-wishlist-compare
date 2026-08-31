import { NextResponse } from "next/server";
import { getReviews } from "@/lib/catalog";
import { debugSummarizeAttempt } from "@/lib/summarize";

// TEMPORARY diagnostic route — not part of the shipped feature set. Runs
// the real summarize.ts path against a real SKU's real reviews and
// surfaces exactly which step fails, instead of guessing from the outside
// (source:"fallback" alone is indistinguishable from "no key", "bad key",
// "model retired", or "validation rejected the response" — all silent by
// design). Delete this file and lib/summarize.ts's debugSummarizeAttempt
// export once diagnosed.
export const dynamic = "force-dynamic";
export const maxDuration = 45; // match /api/summarize's ceiling, not the platform default

export async function GET() {
  const sku = "shirt-roadster-002"; // "thin" band, 9 reviews — above threshold, never tested via UI yet
  const reviews = getReviews(sku);
  const result = await debugSummarizeAttempt(sku, reviews);
  return NextResponse.json({ sku, reviewCount: reviews.length, result });
}
