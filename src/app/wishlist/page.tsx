"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShoppingBag } from "lucide-react";
import { PRODUCTS, OUT_OF_STOCK_PRODUCT_IDS } from "@/lib/catalog";
import { useAppStore, filterByCategory, filterOutOfStock, type ViewCategory } from "@/lib/store";
import { track } from "@/lib/track";
import { showToast } from "@/lib/toast-bus";
import { prefetchSummaries } from "@/lib/useSummaries";
import { shareProduct } from "@/lib/share";
import { SELECTION_MIN } from "@/lib/constants";
import { CategoryTabs } from "@/components/wishlist/CategoryTabs";
import { CompareCTA } from "@/components/wishlist/CompareCTA";
import { CompareIntroBanner } from "@/components/wishlist/CompareIntroBanner";
import { OutOfStockFilterPill } from "@/components/wishlist/OutOfStockFilterPill";
import { ProductTile } from "@/components/wishlist/ProductTile";
import { StickyCompareBar } from "@/components/wishlist/StickyCompareBar";

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export default function WishlistPage() {
  const router = useRouter();
  const wishlist = useAppStore((s) => s.wishlist);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const mode = useAppStore((s) => s.mode);
  const selection = useAppStore((s) => s.selection);
  const bag = useAppStore((s) => s.bag);
  const showOnlyOutOfStock = useAppStore((s) => s.showOnlyOutOfStock);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const setShowOnlyOutOfStock = useAppStore((s) => s.setShowOnlyOutOfStock);
  const enterSelectionMode = useAppStore((s) => s.enterSelectionMode);
  const cancelSelectionMode = useAppStore((s) => s.cancelSelectionMode);
  const toggleSelection = useAppStore((s) => s.toggleSelection);
  const confirmSelection = useAppStore((s) => s.confirmSelection);
  const removeItem = useAppStore((s) => s.removeItem);
  const addToBag = useAppStore((s) => s.addToBag);
  const moveToBag = useAppStore((s) => s.moveToBag);

  const eligibleIds = useMemo(
    () => filterByCategory(wishlist, activeCategory),
    [wishlist, activeCategory],
  );
  const visibleIds = useMemo(
    () => filterOutOfStock(eligibleIds, showOnlyOutOfStock),
    [eligibleIds, showOnlyOutOfStock],
  );

  useEffect(() => {
    if (!hasHydrated) return;
    track("wishlist_viewed", { category: activeCategory, itemCount: eligibleIds.length });
    // Only re-fire when the category actually changes (or once hydration
    // lands) — eligibleIds is derived from wishlist too and would otherwise
    // double-fire on every removal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, hasHydrated]);

  // R2 (2.7): entering/exiting selection mode swaps every tile's wrapper
  // element (Link <-> button — the two modes need genuinely different
  // semantics, not just different styling), which forces React to
  // unmount and remount the whole grid rather than reconciling it in
  // place. That transition was found to reset scrollTop to 0 (verified
  // live, not just suspected) — content shifting above the grid (the
  // CompareCTA block, present only in browse mode) is enough to make the
  // browser clamp scroll position during the swap and never restore it.
  // Explicit save-before/restore-after in a layout effect (so it applies
  // before paint, no visible flash) is more robust than relying on the
  // browser to preserve it implicitly.
  const savedScroll = useRef(0);
  function saveScroll() {
    const el = document.getElementById("app-scroll");
    if (el) savedScroll.current = el.scrollTop;
  }
  useLayoutEffect(() => {
    const el = document.getElementById("app-scroll");
    if (el) el.scrollTop = savedScroll.current;
  }, [mode]);

  function handleCategoryChange(c: ViewCategory) {
    if (mode === "selecting") return; // R2: tabs locked while selecting
    setActiveCategory(c);
  }

  function handleCompareTap() {
    saveScroll();
    track("compare_tapped", { category: activeCategory, eligibleCount: eligibleIds.length });
    enterSelectionMode();
  }

  function handleCancel() {
    saveScroll();
    cancelSelectionMode();
  }

  function handleConfirm() {
    const skus = confirmSelection();
    if (skus) {
      // ARCHITECTURE §2: fire the summarize POST the moment selection is
      // confirmed, while the deck-entry animation plays, not after
      // /compare mounts.
      prefetchSummaries(skus);
      router.push("/compare");
    }
  }

  function handleRemove(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    removeItem(sku, "wishlist_tile");
    showToast(`Removed ${product?.brand ?? "item"} from wishlist`);
  }

  function handleAddToBag(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    addToBag(sku, "wishlist_tile", 0);
    showToast(`Added ${product?.brand ?? "item"} to bag`);
  }

  function handleMoveToBag(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    moveToBag(sku, "wishlist_tile_move_to_bag");
    showToast(`Moved ${product?.brand ?? "item"} to bag`);
  }

  function handleShare(sku: string) {
    const product = PRODUCTS_BY_ID.get(sku);
    if (product) void shareProduct(product);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-4 pb-1 pt-4">
        <div>
          <h1 className="text-[20px] font-bold text-ink">Wishlist</h1>
          <p className="text-[12px] text-ink-faint">{wishlist.length} items</p>
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

      {/* Static, illustrative — same "plausible but non-functional chrome"
          precedent as PhoneFrame's fake status-bar clock/battery. No auth
          exists in this app, so this is never wired to real geolocation. */}
      <div className="flex items-center gap-1.5 px-4 text-[12px] text-ink-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
        <span className="truncate">Deliver to: Bengaluru 560034</span>
      </div>

      <CategoryTabs
        active={activeCategory}
        onChange={handleCategoryChange}
        locked={mode === "selecting"}
      />

      <div className="flex gap-2 px-4 pt-3">
        <OutOfStockFilterPill
          active={showOnlyOutOfStock}
          onChange={setShowOnlyOutOfStock}
          locked={mode === "selecting"}
        />
      </div>

      {mode === "browse" && wishlist.length >= SELECTION_MIN && <CompareIntroBanner />}

      {mode === "browse" && (
        <CompareCTA
          activeCategory={activeCategory}
          eligibleCount={eligibleIds.length}
          onCompare={handleCompareTap}
        />
      )}

      <div className="flex-1 px-4 pb-6 pt-4">
        {visibleIds.length === 0 ? (
          <p className="pt-10 text-center text-[13px] text-ink-faint">
            {showOnlyOutOfStock
              ? "No out-of-stock items in this category."
              : "No items saved in this category yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {visibleIds.map((id) => {
              const product = PRODUCTS_BY_ID.get(id);
              if (!product) return null;
              return (
                <ProductTile
                  key={id}
                  product={product}
                  mode={mode}
                  selected={selection.includes(id)}
                  bagged={bag.includes(id)}
                  outOfStock={OUT_OF_STOCK_PRODUCT_IDS.has(id)}
                  onToggleSelect={() => toggleSelection(id)}
                  onRemoveFromWishlist={() => handleRemove(id)}
                  onAddToBag={() => handleAddToBag(id)}
                  onMoveToBag={() => handleMoveToBag(id)}
                  onShare={() => handleShare(id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {mode === "selecting" && (
        <StickyCompareBar
          count={selection.length}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
