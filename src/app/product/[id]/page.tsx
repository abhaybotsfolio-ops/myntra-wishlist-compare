"use client";

import { use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Heart, ShoppingBag } from "lucide-react";
import { getProduct } from "@/lib/catalog";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { PriceLine } from "@/components/ui/PriceLine";
import { RatingPill } from "@/components/ui/RatingPill";
import { showToast } from "@/lib/toast-bus";

/**
 * ARCHITECTURE.md §3: "a deliberately thin PDP — enough to feel real."
 * router.back() (not a hardcoded destination) is what makes "returning
 * restores the same deck index" (ACCEPTANCE 6.5) work for free — the
 * compare page reads deckIndex from the store, which this page never
 * touches, and going back one browser-history step lands wherever the
 * user actually came from (compare card or wishlist tile) unchanged.
 */
export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const product = getProduct(id);
  const wishlist = useAppStore((s) => s.wishlist);
  const bag = useAppStore((s) => s.bag);
  const addToBag = useAppStore((s) => s.addToBag);
  const removeItem = useAppStore((s) => s.removeItem);

  if (!product) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[14px] text-ink-muted">This item is no longer available.</p>
        <Button variant="secondary" onClick={() => router.push("/wishlist")}>
          Back to wishlist
        </Button>
      </div>
    );
  }

  const inWishlist = wishlist.includes(product.id);
  const bagged = bag.includes(product.id);
  const mountedAt = Date.now();

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative aspect-[3/4] w-full shrink-0 bg-canvas">
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.title}`}
          fill
          draggable={false}
          sizes="(min-width: 768px) 390px, 100vw"
          className="object-cover"
          priority
        />
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink shadow-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {inWishlist && (
          <button
            type="button"
            onClick={() => {
              removeItem(product.id, "pdp");
              showToast(`Removed ${product.brand} from wishlist`);
              router.back();
            }}
            aria-label="Remove from wishlist"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 shadow-card"
          >
            <Heart className="h-5 w-5 fill-brand text-brand" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div>
          <p className="text-[16px] font-bold uppercase tracking-wide text-ink">{product.brand}</p>
          <p className="text-[14px] text-ink-muted">{product.title}</p>
        </div>
        <PriceLine price={product.price} mrp={product.mrp} discountPct={product.discountPct} />
        <RatingPill rating={product.rating} ratingCount={product.ratingCount} />
        <div className="flex gap-6 border-t border-line pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Fit</p>
            <p className="text-[13px] font-semibold text-ink">{product.fit}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Material</p>
            <p className="text-[13px] font-semibold text-ink">{product.material}</p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <Button
          variant={bagged ? "secondary" : "primary"}
          fullWidth
          className={bagged ? "border-positive text-positive-text" : ""}
          onClick={() => {
            addToBag(product.id, "pdp", Date.now() - mountedAt);
            showToast(`Added ${product.brand} to bag`);
          }}
        >
          {bagged ? (
            <>
              <Check className="h-4 w-4" /> Added to Bag
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" /> Add to Bag
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
