import { NextResponse } from "next/server";
import { INVENTORY } from "@/lib/catalog";
import { applyStockEvents } from "@/lib/stock-simulator";

// ship-to-vercel skill: must never be statically cached, or the live stock
// update silently stops working in production while still passing every
// local test — that failure mode is easy to miss because it only shows up
// under Vercel's edge caching, not in `next dev`.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skusParam = searchParams.get("skus");
  const skus = skusParam ? skusParam.split(",").filter(Boolean) : Object.keys(INVENTORY);

  const deckStartedAtParam = searchParams.get("deckStartedAt");
  const deckStartedAt = deckStartedAtParam ? Number(deckStartedAtParam) : null;

  const effective = applyStockEvents(
    INVENTORY,
    skus,
    Number.isFinite(deckStartedAt) ? deckStartedAt : null,
  );

  const inventory: typeof INVENTORY = {};
  for (const sku of skus) {
    if (effective[sku]) inventory[sku] = effective[sku];
  }

  return NextResponse.json({ inventory, serverTime: Date.now() });
}
