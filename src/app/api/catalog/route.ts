import { NextResponse } from "next/server";
import { getProducts, getReviewCount, PRODUCTS } from "@/lib/catalog";

// Static seed data — no request-time work needed, safe to let Next cache it.
export const dynamic = "force-static";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const products =
    category === "shirts" || category === "pants" ? getProducts(category) : getProducts();

  // Review *metadata* only (counts), not full text — nothing in the UI
  // ever renders a raw review; R5 replaces that with summaries. Full text
  // stays server-side, used only by /api/summarize and the seed-time
  // fallback authoring.
  const reviewCounts: Record<string, number> = {};
  for (const p of PRODUCTS) reviewCounts[p.id] = getReviewCount(p.id);

  return NextResponse.json({ products, reviewCounts });
}
