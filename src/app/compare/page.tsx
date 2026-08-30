"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { PRODUCTS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store";
import { track } from "@/lib/track";
import { showToast } from "@/lib/toast-bus";
import { SELECTION_MIN } from "@/lib/constants";
import { getRecommendedSize, getStatus } from "@/lib/size";
import { useInventory } from "@/lib/useInventory";
import { useSummaries } from "@/lib/useSummaries";
import { computeDeckStats } from "@/lib/compareStats";
import { CompareDeck, type SizeInfo } from "@/components/compare/CompareDeck";
import { PositionIndicator } from "@/components/compare/PositionIndicator";
import { AlignmentOverlay } from "@/components/compare/AlignmentOverlay";
import { SummaryStrip } from "@/components/compare/SummaryStrip";

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export default function ComparePage() {
  const router = useRouter();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const deck = useAppStore((s) => s.deck);
  const deckIndex = useAppStore((s) => s.deckIndex);
  const deckStartedAt = useAppStore((s) => s.deckStartedAt);
  const bag = useAppStore((s) => s.bag);
  const sizeProfile = useAppStore((s) => s.sizeProfile);
  const setDeckIndex = useAppStore((s) => s.setDeckIndex);
  const removeItem = useAppStore((s) => s.removeItem);
  const addToBag = useAppStore((s) => s.addToBag);

  const sessionStart = useRef(Date.now());
  const swipeCount = useRef(0);
  const decided = useRef(false);
  const exitReason = useRef("left_compare");

  const products = useMemo(
    () => deck.map((id) => PRODUCTS_BY_ID.get(id)).filter((p) => p !== undefined),
    [deck],
  );

  // Resolved once per product list, not per poll — recommendation is pure
  // local data (size-wedge skill concern 1), unrelated to inventory.
  const recommendationBySku = useMemo(() => {
    const map: Record<string, ReturnType<typeof getRecommendedSize>> = {};
    for (const p of products) map[p.id] = getRecommendedSize(sizeProfile, p.brand);
    return map;
  }, [products, sizeProfile]);

  const recommendedMetaBySku = useMemo(() => {
    const map: Record<string, { size: string; brand: string }> = {};
    for (const p of products) {
      const rec = recommendationBySku[p.id];
      if (rec) map[p.id] = { size: rec.size, brand: p.brand };
    }
    return map;
  }, [products, recommendationBySku]);

  // Hooks must run unconditionally (before the early-return guard below) —
  // deck is [] pre-hydration, which is a harmless empty poll.
  const { inventory, loaded } = useInventory(deck, deckStartedAt, recommendedMetaBySku);
  const { summaries: summaryBySku } = useSummaries(deck);

  const sizeInfoBySku: Record<string, SizeInfo> = useMemo(() => {
    const map: Record<string, SizeInfo> = {};
    for (const p of products) {
      const recommendation = recommendationBySku[p.id];
      map[p.id] = {
        recommendation,
        status: !recommendation ? "available" : !loaded ? "loading" : getStatus(inventory, p.id, recommendation.size),
      };
    }
    return map;
  }, [products, recommendationBySku, inventory, loaded]);

  // Deck-wide, not per-card — computed once here (same pure-function
  // pattern as lib/size.ts) and threaded down: leaderBySku into every
  // CompareCard's price/rating rows, the rest into the SummaryStrip above
  // the deck. Recomputes automatically if the scripted stock event flips a
  // card's sizeStatus mid-session, since it depends on sizeInfoBySku.
  const deckStats = useMemo(() => computeDeckStats(products, sizeInfoBySku), [products, sizeInfoBySku]);

  // R3: /compare redirects to /wishlist if the set has fewer than 2 items.
  // Gated on hasHydrated — before rehydration, `deck` is briefly the
  // pre-session default ([]), which would otherwise false-positive redirect
  // on every fresh load before sessionStorage catches up.
  //
  // Checked once (ref-guarded), not on every deck.length change: dropping
  // below the minimum via Remove is already handled explicitly in
  // handleRemove below, with its own toast explaining why. This effect is
  // only for "arrived at /compare with an already-insufficient deck" —
  // direct navigation or a stale session — so re-running it on every
  // removal would just be a second, unexplained redirect racing the first.
  const redirectChecked = useRef(false);
  useEffect(() => {
    if (!hasHydrated || redirectChecked.current) return;
    redirectChecked.current = true;
    if (useAppStore.getState().deck.length < SELECTION_MIN) {
      router.replace("/wishlist");
    }
  }, [hasHydrated, router]);

  useEffect(() => {
    // Deliberately reading refs at cleanup time, not at effect-setup time:
    // this fires exactly once, on unmount, and needs whatever the *latest*
    // swipe/decided/reason values are at that moment — a dependency array
    // would instead fire on every update to those refs, which they don't
    // even trigger re-renders for.
    /* eslint-disable react-hooks/exhaustive-deps */
    return () => {
      track("comparison_exited", {
        reason: exitReason.current,
        durationMs: Date.now() - sessionStart.current,
        swipes: swipeCount.current,
        decided: decided.current,
      });
    };
    /* eslint-enable react-hooks/exhaustive-deps */
  }, []);

  if (!hasHydrated || deck.length < SELECTION_MIN) {
    return <div className="min-h-full" />;
  }

  const clampedIndex = Math.min(deckIndex, products.length - 1);

  function handleBack() {
    exitReason.current = "back_button";
    router.push("/wishlist");
  }

  function handleAddToBag(sku: string, dwellMs: number) {
    addToBag(sku, "compare_card", dwellMs);
    decided.current = true;
    const product = PRODUCTS_BY_ID.get(sku);
    showToast(`Added ${product?.brand ?? "item"} to bag`, { tone: "neutral" });
  }

  function handleRemove(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    const result = removeItem(sku, "compare_card");
    if (result.deckBelowMin) {
      exitReason.current = "removed_below_minimum";
      showToast(`Removed ${product?.brand ?? "item"} — only ${result.remaining} left, back to wishlist`);
      router.replace("/wishlist");
    } else {
      showToast(`Removed ${product?.brand ?? "item"} from comparison`);
    }
  }

  function handleOpenProduct(sku: string) {
    track("pdp_opened", { sku, fromSurface: "compare_card" });
  }

  return (
    <div className="flex min-h-full flex-col">
      <AlignmentOverlay />
      <header className="flex items-center justify-between px-2 pt-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to wishlist"
          className="flex h-11 w-11 items-center justify-center text-ink"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <PositionIndicator index={clampedIndex} count={products.length} />
        <div className="flex h-11 w-11 items-center justify-center text-ink-muted">
          <div className="relative">
            <ShoppingBag className="h-5 w-5" />
            {bag.length > 0 && (
              <span
                data-testid="bag-count"
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white"
              >
                {bag.length}
              </span>
            )}
          </div>
        </div>
      </header>

      <SummaryStrip stats={deckStats} />

      <CompareDeck
        products={products}
        index={clampedIndex}
        onIndexChange={(i) => {
          setDeckIndex(i);
          swipeCount.current += 1;
        }}
        bag={bag}
        sizeInfoBySku={sizeInfoBySku}
        summaryBySku={summaryBySku}
        leaderBySku={deckStats.leaderBySku}
        onAddToBag={handleAddToBag}
        onRemove={handleRemove}
        onOpenProduct={handleOpenProduct}
      />
    </div>
  );
}
