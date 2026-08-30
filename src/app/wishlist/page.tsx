"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTS } from "@/lib/catalog";
import { useAppStore, filterByCategory, type ViewCategory } from "@/lib/store";
import { track } from "@/lib/track";
import { showToast } from "@/lib/toast-bus";
import { prefetchSummaries } from "@/lib/useSummaries";
import { CategoryTabs } from "@/components/wishlist/CategoryTabs";
import { CompareCTA } from "@/components/wishlist/CompareCTA";
import { ProductTile } from "@/components/wishlist/ProductTile";
import { StickyCompareBar } from "@/components/wishlist/StickyCompareBar";

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export default function WishlistPage() {
  const router = useRouter();
  const wishlist = useAppStore((s) => s.wishlist);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const mode = useAppStore((s) => s.mode);
  const selection = useAppStore((s) => s.selection);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const enterSelectionMode = useAppStore((s) => s.enterSelectionMode);
  const cancelSelectionMode = useAppStore((s) => s.cancelSelectionMode);
  const toggleSelection = useAppStore((s) => s.toggleSelection);
  const confirmSelection = useAppStore((s) => s.confirmSelection);
  const removeItem = useAppStore((s) => s.removeItem);

  const visibleIds = useMemo(
    () => filterByCategory(wishlist, activeCategory),
    [wishlist, activeCategory],
  );

  useEffect(() => {
    if (!hasHydrated) return;
    track("wishlist_viewed", { category: activeCategory, itemCount: visibleIds.length });
    // Only re-fire when the category actually changes (or once hydration
    // lands) — visibleIds is derived from wishlist too and would otherwise
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
    track("compare_tapped", { category: activeCategory, eligibleCount: visibleIds.length });
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 pb-1 pt-4">
        <h1 className="text-[20px] font-bold text-ink">Wishlist</h1>
      </header>

      <CategoryTabs
        active={activeCategory}
        onChange={handleCategoryChange}
        locked={mode === "selecting"}
      />

      {mode === "browse" && (
        <CompareCTA
          activeCategory={activeCategory}
          eligibleCount={visibleIds.length}
          onCompare={handleCompareTap}
        />
      )}

      <div className="flex-1 px-4 pb-6 pt-4">
        {visibleIds.length === 0 ? (
          <p className="pt-10 text-center text-[13px] text-ink-faint">
            No items saved in this category yet.
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
                  onToggleSelect={() => toggleSelection(id)}
                  onRemoveFromWishlist={() => handleRemove(id)}
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
