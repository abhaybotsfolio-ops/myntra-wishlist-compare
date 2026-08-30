"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Heart } from "lucide-react";
import type { Product } from "../../../data/schema.ts";
import { PriceLine } from "@/components/ui/PriceLine";

interface ProductTileProps {
  product: Product;
  mode: "browse" | "selecting";
  selected: boolean;
  onToggleSelect: () => void;
  onRemoveFromWishlist: () => void;
}

/**
 * myntra-ui skill: 3:4 image, brand 14/700, title 13/400 one line, price
 * line, small heart affordance; in selection mode a 22px checkbox replaces
 * it and selected tiles get a 2px brand ring + brand-tint background.
 *
 * The whole-tile tap target (Link in browse mode, button in selecting
 * mode) and the heart button are DOM siblings, not nested — an <a> can't
 * legally contain a <button>, so the heart sits absolutely positioned on
 * top instead of inside the link.
 */
export function ProductTile({
  product,
  mode,
  selected,
  onToggleSelect,
  onRemoveFromWishlist,
}: ProductTileProps) {
  const body = (
    <>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded bg-canvas">
        <Image
          src={product.images[0]}
          alt=""
          fill
          draggable={false}
          sizes="(min-width: 768px) 175px, 45vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-1 px-0.5 pt-2">
        <p className="truncate text-[14px] font-bold uppercase tracking-wide text-ink">
          {product.brand}
        </p>
        <p className="truncate text-[13px] font-normal text-ink-muted">{product.title}</p>
        <PriceLine price={product.price} mrp={product.mrp} discountPct={product.discountPct} />
      </div>
    </>
  );

  return (
    <div
      className={`relative rounded-lg p-1.5 transition-colors ${
        mode === "selecting" && selected
          ? "bg-brand-tint ring-2 ring-brand"
          : mode === "selecting"
            ? "opacity-80"
            : ""
      }`}
    >
      {mode === "selecting" ? (
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${product.brand} ${product.title} for comparison`}
          className="block w-full text-left"
        >
          {body}
        </button>
      ) : (
        <Link
          href={`/product/${product.id}`}
          aria-label={`${product.brand} ${product.title}, view product`}
          className="block"
        >
          {body}
        </Link>
      )}

      {mode === "selecting" ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${
            selected ? "border-brand bg-brand" : "border-surface bg-surface/90"
          } shadow-card`}
        >
          {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>
      ) : (
        <button
          type="button"
          onClick={onRemoveFromWishlist}
          aria-label={`Remove ${product.brand} ${product.title} from wishlist`}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
        >
          <Heart className="h-5 w-5 fill-brand text-brand drop-shadow-sm" />
        </button>
      )}
    </div>
  );
}
