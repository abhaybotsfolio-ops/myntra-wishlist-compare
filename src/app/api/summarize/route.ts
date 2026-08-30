import { NextResponse } from "next/server";
import { getReviews } from "@/lib/catalog";
import { resolveSummary } from "@/lib/summarize";

export const maxDuration = 15; // ship-to-vercel skill — this is a POST with a real LLM call

export async function POST(request: Request) {
  let skus: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.skus)) {
      skus = body.skus.filter((s: unknown): s is string => typeof s === "string");
    }
  } catch {
    return NextResponse.json({ summaries: [] }, { status: 400 });
  }

  // Promise.allSettled, not sequential — a 4-card deck must not take 4x a
  // single call (review-summarizer skill).
  const settled = await Promise.allSettled(
    skus.map((sku) => resolveSummary(sku, getReviews(sku))),
  );

  const summaries = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { sku: skus[i], status: "insufficient_reviews" as const, themes: [], source: "fallback" as const, basedOn: 0 },
  );

  return NextResponse.json({ summaries });
}
