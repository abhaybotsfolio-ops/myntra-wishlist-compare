"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTS } from "@/lib/catalog";
import { useAppStore, filterByCategory, type ViewCategory } from "@/lib/store";
import { track } from "@/lib/track";
import { showToast } from "@/lib/toast-bus";
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

  function handleCategoryChange(c: ViewCategory) {
    if (mode === "selecting") return; // R2: tabs locked while selecting
    setActiveCategory(c);
  }

  function handleCompareTap() {
    track("compare_tapped", { category: activeCategory, eligibleCount: visibleIds.length });
    enterSelectionMode();
  }

  function handleConfirm() {
    const skus = confirmSelection();
    if (skus) router.push("/compare");
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
          onCancel={cancelSelectionMode}
        />
      )}
    </div>
  );
}
