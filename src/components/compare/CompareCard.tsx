"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Product } from "../../../data/schema.ts";
import { ATTRIBUTE_ROWS, type AttributeRowKey } from "@/lib/constants";
import type { AvailabilityStatus, SizeRecommendation } from "@/lib/size";
import { track } from "@/lib/track";
import { PriceLine } from "@/components/ui/PriceLine";
import { RatingPill } from "@/components/ui/RatingPill";
import { SkeletonText } from "@/components/ui/Skeleton";
import { CardActions } from "@/components/compare/CardActions";
import { SizeWedge } from "@/components/compare/SizeWedge";
import { SizeGuideSheet } from "@/components/compare/SizeGuideSheet";

interface CompareCardProps {
  product: Product;
  isActive: boolean;
  bagged: boolean;
  recommendation: SizeRecommendation | null;
  sizeStatus: AvailabilityStatus | "loading";
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
 * The review-summary row is still a skeleton — Phase 7 replaces it with
 * ReviewSummary.
 */
export function CompareCard({
  product,
  isActive,
  bagged,
  recommendation,
  sizeStatus,
  onAddToBag,
  onRemove,
  onOpenProduct,
}: CompareCardProps) {
  const activeSince = useRef(Date.now());
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  useEffect(() => {
    if (isActive) activeSince.current = Date.now();
  }, [isActive]);

  useEffect(() => {
    if (sizeStatus === "loading") return;
    track("size_wedge_viewed", {
      sku: product.id,
      status: recommendation ? sizeStatus : "no_signal",
      hasSignal: !!recommendation,
    });
    // fire once per resolved status, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeStatus, !!recommendation]);

  function handleSizeWedgeTap() {
    track("size_wedge_tapped", {
      sku: product.id,
      status: recommendation ? sizeStatus : "no_signal",
    });
    if (!recommendation) setSizeGuideOpen(true);
  }

  const disabledReason =
    sizeStatus === "unavailable" && recommendation
      ? `Unavailable in your size (${recommendation.size})`
      : undefined;

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
          <>
            <SizeWedge
              recommendation={recommendation}
              status={sizeStatus}
              onTap={handleSizeWedgeTap}
            />
            <SizeGuideSheet
              open={sizeGuideOpen}
              onClose={() => setSizeGuideOpen(false)}
              category={product.category}
              brand={product.brand}
            />
          </>
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
            disabledReason={disabledReason}
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
