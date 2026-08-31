"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Trash2, ArrowRightLeft, Share2, ShoppingBag } from "lucide-react";
import type { Product } from "../../../data/schema.ts";
import { PriceLine } from "@/components/ui/PriceLine";
import { RatingPill } from "@/components/ui/RatingPill";

interface ProductTileProps {
  product: Product;
  mode: "browse" | "selecting";
  selected: boolean;
  bagged: boolean;
  outOfStock: boolean;
  onToggleSelect: () => void;
  onRemoveFromWishlist: () => void;
  onAddToBag: () => void;
  onMoveToBag: () => void;
  onShare: () => void;
}

/**
 * myntra-ui skill: 3:4 image, brand 14/700, title 13/400 one line, price
 * line — extended here with a rating badge and an Add-to-Bag pill overlaid
 * on the image, a delivery estimate line, and a below-tile icon row
 * (delete / move to bag / share), matching the real Myntra wishlist tile
 * the operator shared as a reference. In selection mode the tile collapses
 * back to the original single-button checkbox pattern — none of the new
 * shopping actions apply while selecting items to compare.
 *
 * Browse mode uses TWO separate <Link>s (image, text) to the same product,
 * not one wrapping both: the Add-to-Bag pill must be a DOM sibling of
 * whatever wraps the image (an <a> can't legally contain a <button>), and
 * anchoring the pill to exactly the image's box — not the whole tile's —
 * needs its containing block to be the image link's own box. The image
 * link carries real alt text (its accessible name, since it has no visible
 * text of its own); the text link's accessible name derives from its
 * visible brand/title/price content, same as before.
 */
export function ProductTile({
  product,
  mode,
  selected,
  bagged,
  outOfStock,
  onToggleSelect,
  onRemoveFromWishlist,
  onAddToBag,
  onMoveToBag,
  onShare,
}: ProductTileProps) {
  const href = `/product/${product.id}`;
  const name = `${product.brand} ${product.title}`;

  const imageBox = (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-[10px] bg-canvas ${
        outOfStock ? "opacity-60 grayscale" : ""
      }`}
    >
      <Image
        src={product.images[0]}
        alt={mode === "selecting" ? "" : name}
        fill
        draggable={false}
        sizes="(min-width: 768px) 175px, 45vw"
        className="object-cover"
      />
      <span className="absolute bottom-2 left-2 rounded-full bg-surface/95 px-1.5 py-0.5 shadow-card">
        <RatingPill rating={product.rating} ratingCount={product.ratingCount} compact />
      </span>
      {outOfStock && (
        <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink shadow-card">
          Out of stock
        </span>
      )}
    </div>
  );

  const textBlock = (
    <div className="flex flex-col gap-1 px-0.5 pt-2">
      <p className="truncate text-[14px] font-bold uppercase tracking-wide text-ink">
        {product.brand}
      </p>
      <p className="truncate text-[13px] font-normal text-ink-muted">{product.title}</p>
      <PriceLine price={product.price} mrp={product.mrp} discountPct={product.discountPct} />
      <p className="truncate text-[11px] text-ink-faint">{product.deliveryEstimate}</p>
    </div>
  );

  if (mode === "selecting") {
    return (
      <div
        className={`relative rounded-xl border p-1.5 transition-colors ${
          selected ? "border-brand bg-brand-tint" : "border-line opacity-80"
        }`}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${name} for comparison`}
          className="block w-full text-left"
        >
          {imageBox}
          {textBlock}
        </button>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${
            selected ? "border-brand bg-brand" : "border-surface bg-ink/35"
          } shadow-card`}
        >
          {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-line p-1.5">
      <div className="relative">
        <Link href={href} className="block">
          {imageBox}
        </Link>
        <button
          type="button"
          aria-disabled={outOfStock || undefined}
          aria-label={
            outOfStock
              ? `${name} is out of stock`
              : bagged
                ? `${name} added to bag`
                : `Add ${name} to bag`
          }
          onClick={(e) => {
            if (outOfStock) {
              e.preventDefault();
              return;
            }
            onAddToBag();
          }}
          className="absolute bottom-1 right-1 z-10 flex h-11 w-11 items-center justify-center"
        >
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full shadow-card transition-colors ${
              outOfStock
                ? "bg-surface/80 text-ink-faint"
                : bagged
                  ? "bg-positive-text text-white"
                  : "bg-surface text-brand-dark"
            }`}
          >
            {bagged ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
          </span>
        </button>
      </div>

      <Link href={href} className="block">
        {textBlock}
      </Link>

      <div className="mt-0.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onRemoveFromWishlist}
          aria-label={`Remove ${name} from wishlist`}
          className="flex h-11 w-11 items-center justify-center text-ink-faint"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-disabled={outOfStock || undefined}
          aria-label={`Move ${name} to bag`}
          onClick={(e) => {
            if (outOfStock) {
              e.preventDefault();
              return;
            }
            onMoveToBag();
          }}
          className={`flex h-11 w-11 items-center justify-center text-ink-faint ${outOfStock ? "opacity-40" : ""}`}
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label={`Share ${name}`}
          className="flex h-11 w-11 items-center justify-center text-ink-faint"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
