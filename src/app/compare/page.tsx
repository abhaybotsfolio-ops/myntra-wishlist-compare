"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ShoppingBag } from "lucide-react";
import { PRODUCTS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store";
import { track } from "@/lib/track";
import { showToast } from "@/lib/toast-bus";
import { SELECTION_MIN } from "@/lib/constants";
import { getRecommendedSize, getStatus } from "@/lib/size";
import { useInventory } from "@/lib/useInventory";
import { useSummaries } from "@/lib/useSummaries";
import { computeDeckStats } from "@/lib/compareStats";
import { computePickForYou } from "@/lib/pickForYou";
import { CompareCarousel, type SizeInfo } from "@/components/compare/CompareCarousel";
import { PositionIndicator } from "@/components/compare/PositionIndicator";
import { AtAGlanceTable } from "@/components/compare/AtAGlanceTable";
import { DetailsTable } from "@/components/compare/DetailsTable";
import { PickForYouCard } from "@/components/compare/PickForYouCard";
import { ReviewSummary } from "@/components/compare/ReviewSummary";
import { SizeGuideSheet } from "@/components/compare/SizeGuideSheet";
import { Button } from "@/components/ui/Button";

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export default function ComparePage() {
  const router = useRouter();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const wishlist = useAppStore((s) => s.wishlist);
  const deck = useAppStore((s) => s.deck);
  const deckIndex = useAppStore((s) => s.deckIndex);
  const deckStartedAt = useAppStore((s) => s.deckStartedAt);
  const bag = useAppStore((s) => s.bag);
  const sizeProfile = useAppStore((s) => s.sizeProfile);
  const setDeckIndex = useAppStore((s) => s.setDeckIndex);
  const removeItem = useAppStore((s) => s.removeItem);
  const removeFromDeck = useAppStore((s) => s.removeFromDeck);
  const restoreWishlistItem = useAppStore((s) => s.restoreWishlistItem);
  const restoreDeckItem = useAppStore((s) => s.restoreDeckItem);
  const addToBag = useAppStore((s) => s.addToBag);

  const [sizeGuideSku, setSizeGuideSku] = useState<string | null>(null);

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
  // pattern as lib/size.ts) and threaded into the carousel's leader chips
  // and the At a glance table. Recomputes automatically if the scripted
  // stock event flips a card's sizeStatus mid-session.
  const deckStats = useMemo(() => computeDeckStats(products, sizeInfoBySku), [products, sizeInfoBySku]);

  // D8 — operator-directed override of RULES B3, see DECISIONS.md.
  const pick = useMemo(() => computePickForYou(products, sizeInfoBySku), [products, sizeInfoBySku]);

  // R3: /compare redirects to /wishlist if the set has fewer than 2 items.
  // Gated on hasHydrated — before rehydration, `deck` is briefly the
  // pre-session default ([]), which would otherwise false-positive redirect
  // on every fresh load before sessionStorage catches up.
  const redirectChecked = useRef(false);
  useEffect(() => {
    if (!hasHydrated || redirectChecked.current) return;
    redirectChecked.current = true;
    if (useAppStore.getState().deck.length < SELECTION_MIN) {
      router.replace("/wishlist");
    }
  }, [hasHydrated, router]);

  useEffect(() => {
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
  const activeProduct = products[clampedIndex];
  const activeBagged = bag.includes(activeProduct.id);
  const activeSizeInfo = sizeInfoBySku[activeProduct.id];
  const activeDisabledReason =
    activeSizeInfo?.status === "unavailable" && activeSizeInfo.recommendation
      ? `Unavailable in your size (${activeSizeInfo.recommendation.size})`
      : undefined;

  function handleBack() {
    exitReason.current = "back_button";
    router.push("/wishlist");
  }

  function handleAddToBag() {
    addToBag(activeProduct.id, "compare_card", Date.now() - sessionStart.current);
    decided.current = true;
    showToast(`Added ${activeProduct.brand} to bag`, { tone: "neutral" });
  }

  // Heart — unsave from wishlist entirely (cascades out of the deck too).
  // Undo restores it to both lists at their pre-removal positions.
  function handleUnsave(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    const wishlistIndex = wishlist.indexOf(sku);
    const deckIdx = deck.indexOf(sku);
    const result = removeItem(sku, "compare_card");
    const goingBack = result.deckBelowMin;
    if (goingBack) {
      exitReason.current = "removed_below_minimum";
      router.replace("/wishlist");
    }
    showToast(
      `Removed ${product?.brand ?? "item"} from wishlist`,
      goingBack
        ? undefined
        : {
            actionLabel: "Undo",
            onAction: () => {
              restoreWishlistItem(sku, wishlistIndex);
              restoreDeckItem(sku, deckIdx);
            },
          },
    );
  }

  // X — remove from this comparison only, stays on the wishlist.
  function handleRemoveFromCompare(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    const deckIdx = deck.indexOf(sku);
    const result = removeFromDeck(sku);
    if (result.deckBelowMin) {
      exitReason.current = "removed_below_minimum";
      showToast(`Removed ${product?.brand ?? "item"} — only ${result.remaining} left, back to wishlist`);
      router.replace("/wishlist");
      return;
    }
    showToast(`Removed ${product?.brand ?? "item"} from this comparison`, {
      actionLabel: "Undo",
      onAction: () => restoreDeckItem(sku, deckIdx),
    });
  }

  function handleNotify(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    const rec = recommendationBySku[sku];
    showToast(`We'll notify you when ${product?.brand ?? "this item"}'s size ${rec?.size ?? ""} is back`.trim());
  }

  function handleOpenProduct(sku: string) {
    track("pdp_opened", { sku, fromSurface: "compare_card" });
  }

  const sizeGuideProduct = sizeGuideSku ? PRODUCTS_BY_ID.get(sizeGuideSku) : undefined;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-2 pt-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to wishlist"
          className="flex h-11 w-11 items-center justify-center text-ink"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-[19px] font-extrabold text-ink">Compare</h1>
          <p className="text-[11px] font-medium text-ink-muted">See what&apos;s different before you buy</p>
        </div>
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

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <CompareCarousel
          products={products}
          index={clampedIndex}
          onIndexChange={(i) => {
            setDeckIndex(i);
            swipeCount.current += 1;
          }}
          sizeInfoBySku={sizeInfoBySku}
          leaderBySku={deckStats.leaderBySku}
          onUnsave={handleUnsave}
          onRemoveFromCompare={handleRemoveFromCompare}
          onOpenSizeGuide={setSizeGuideSku}
          onNotify={handleNotify}
          onOpenProduct={handleOpenProduct}
        />
        <PositionIndicator index={clampedIndex} count={products.length} />

        <AtAGlanceTable products={products} activeIndex={clampedIndex} sizeInfoBySku={sizeInfoBySku} />
        <DetailsTable products={products} activeIndex={clampedIndex} />

        <div data-testid="review-summary-section" className="mx-4 mt-3 rounded-xl border border-line bg-surface p-3.5">
          <h4 className="mb-2 text-[12.5px] font-extrabold text-ink">
            What buyers say — {activeProduct.brand}
          </h4>
          <ReviewSummary sku={activeProduct.id} summary={summaryBySku[activeProduct.id]} />
        </div>

        {pick && PRODUCTS_BY_ID.get(pick.productId) && (
          <PickForYouCard pick={pick} product={PRODUCTS_BY_ID.get(pick.productId)!} />
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <Button
          variant={activeBagged ? "secondary" : "primary"}
          fullWidth
          disabled={!!activeDisabledReason}
          onClick={handleAddToBag}
          className={`h-14 ${activeBagged ? "border-positive-text text-positive-text" : ""}`}
        >
          {activeBagged ? (
            <>
              <Check className="h-4 w-4" /> Added to Bag
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" /> Add to Bag
            </>
          )}
        </Button>
        {activeDisabledReason && (
          <p className="mt-1 text-center text-[11px] text-ink-faint">{activeDisabledReason}</p>
        )}
      </div>

      {sizeGuideProduct && (
        <SizeGuideSheet
          open={!!sizeGuideSku}
          onClose={() => setSizeGuideSku(null)}
          category={sizeGuideProduct.category}
          brand={sizeGuideProduct.brand}
        />
      )}
    </div>
  );
}
