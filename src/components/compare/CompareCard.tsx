"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { Product } from "../../../data/schema.ts";
import { ATTRIBUTE_ROWS, type AttributeRowKey } from "@/lib/constants";
import { PriceLine } from "@/components/ui/PriceLine";
import { RatingPill } from "@/components/ui/RatingPill";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { CardActions } from "@/components/compare/CardActions";

interface CompareCardProps {
  product: Product;
  isActive: boolean;
  bagged: boolean;
  onAddToBag: (dwellMs: number) => void;
  onRemove: () => void;
  onOpenProduct: () => void;
}

/**
 * Maps ATTRIBUTE_ROWS in fixed order — this is R3's whole mechanic (RULES
 * E1/E2, ARCHITECTURE §6). Every card, every product, same array, same
 * minHeight per row: that's what guarantees pixel alignment rather than
 * hoping for it. Rows 1-8 scroll if they overflow; the actions row is
 * pinned outside that scroll area so Add to Bag is never scrolled away
 * (RULES E3).
 *
 * The size (R4) and review-summary (R5) rows are skeletons here — Phase 6
 * and Phase 7 replace them with SizeWedge and ReviewSummary respectively.
 * A skeleton is not a placeholder for "unfinished"; it's the same
 * loading-state contract those rows use once real data is async, so this
 * card doesn't change shape when that lands.
 */
export function CompareCard({
  product,
  isActive,
  bagged,
  onAddToBag,
  onRemove,
  onOpenProduct,
}: CompareCardProps) {
  const activeSince = useRef(Date.now());
  useEffect(() => {
    if (isActive) activeSince.current = Date.now();
  }, [isActive]);

  function renderRow(key: AttributeRowKey) {
    switch (key) {
      case "image":
        // Explicit pixel height, not h-full: the row div only sets
        // min-height (RULES E2 — never a fixed height that could clip
        // taller content on another row), which doesn't give a percentage
        // child a definite height to resolve against. The fill Image is
        // absolutely positioned either way, so it needs this wrapper to
        // have a real, non-ambiguous height.
        return (
          <div
            className="relative w-full overflow-hidden rounded-lg bg-canvas"
            style={{ height: ATTRIBUTE_ROWS.find((r) => r.key === "image")!.minH }}
          >
            <Image
              src={product.images[0]}
              alt={`${product.brand} ${product.title}`}
              fill
              sizes="(min-width: 768px) 366px, 90vw"
              className="object-cover"
              priority={isActive}
            />
          </div>
        );
      case "identity":
        return (
          <div>
            <p className="text-[14px] font-bold uppercase tracking-wide text-ink">
              {product.brand}
            </p>
            <p className="line-clamp-2 text-[13px] text-ink-muted">{product.title}</p>
          </div>
        );
      case "price":
        return (
          <PriceLine price={product.price} mrp={product.mrp} discountPct={product.discountPct} />
        );
      case "rating":
        return <RatingPill rating={product.rating} ratingCount={product.ratingCount} />;
      case "size":
        return (
          <div className="flex items-center gap-2">
            <Skeleton className="h-[52px] w-full rounded-lg" />
          </div>
        );
      case "fit":
        return <LabeledValue label="Fit" value={product.fit} />;
      case "material":
        return <LabeledValue label="Material" value={product.material} />;
      case "reviews":
        return <SkeletonText lines={3} />;
      case "actions":
        return (
          <CardActions
            product={product}
            bagged={bagged}
            onAddToBag={() => onAddToBag(Date.now() - activeSince.current)}
            onRemove={onRemove}
            onOpenProduct={onOpenProduct}
          />
        );
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ATTRIBUTE_ROWS.filter((r) => r.key !== "actions").map(({ key, minH }) => (
          <div
            key={key}
            data-row={key}
            style={{ minHeight: minH }}
            className="flex flex-col justify-center border-b border-line px-3 py-2 last:border-0"
          >
            {renderRow(key)}
          </div>
        ))}
      </div>
      <div
        data-row="actions"
        style={{ minHeight: ATTRIBUTE_ROWS.find((r) => r.key === "actions")!.minH }}
        className="shrink-0 border-t border-line bg-surface"
      >
        {renderRow("actions")}
      </div>
    </div>
  );
}

function LabeledValue({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <span className="text-[13px] font-semibold text-ink">{value || "—"}</span>
    </div>
  );
}
