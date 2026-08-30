"use client";

import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { Button, Reason } from "@/components/ui/Button";
import type { Product } from "../../../data/schema.ts";

interface CardActionsProps {
  product: Product;
  bagged: boolean;
  disabledReason?: string;
  onAddToBag: () => void;
  onRemove: () => void;
  onOpenProduct: () => void;
}

/**
 * RULES E3/E4/E5: Add to Bag always reachable without scrolling (this row
 * is pinned by CompareCard, not by anything here); Remove is a visually
 * lighter secondary action at the bottom; nothing here navigates away or
 * advances the deck except the explicit "See product" link.
 */
export function CardActions({
  product,
  bagged,
  disabledReason,
  onAddToBag,
  onRemove,
  onOpenProduct,
}: CardActionsProps) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <Button
        variant={bagged ? "secondary" : "primary"}
        fullWidth
        disabled={!!disabledReason}
        onClick={onAddToBag}
        className={bagged ? "border-positive text-positive-text" : ""}
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
      {/* Fixed-height slot regardless of whether a reason is present —
          RULES E1/E2's row-alignment guarantee applies to this row like
          any other; a reason line that only sometimes exists would make
          this specific card's actions row taller than its neighbors'. */}
      <Reason className={`-mt-1 h-3.5 ${disabledReason ? "" : "invisible"}`}>
        {disabledReason || "placeholder"}
      </Reason>

      <div className="flex items-center justify-between">
        <Link
          href={`/product/${product.id}`}
          onClick={onOpenProduct}
          className="min-h-11 rounded-lg px-2 text-[13px] font-semibold text-brand-dark"
        >
          See product
        </Link>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 rounded-lg px-2 text-[12px] text-ink-faint underline-offset-2 hover:underline"
        >
          Remove from wishlist
        </button>
      </div>
    </div>
  );
}
