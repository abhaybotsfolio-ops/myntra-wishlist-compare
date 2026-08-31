"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import type { Product } from "../../../data/schema.ts";
import type { AvailabilityStatus, SizeRecommendation } from "@/lib/size";
import type { LeaderInfo } from "@/lib/compareStats";
import { track } from "@/lib/track";
import { PriceLine } from "@/components/ui/PriceLine";
import { RatingPill } from "@/components/ui/RatingPill";
import { LeaderChip } from "@/components/compare/LeaderChip";
import { SizeLine } from "@/components/compare/SizeLine";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34 };
const VELOCITY_THRESHOLD = 500;
const DISPLACEMENT_RATIO = 0.3;

export interface SizeInfo {
  recommendation: SizeRecommendation | null;
  status: AvailabilityStatus | "loading";
}

interface CompareCarouselProps {
  products: Product[];
  index: number;
  onIndexChange: (i: number) => void;
  sizeInfoBySku: Record<string, SizeInfo>;
  leaderBySku: Record<string, LeaderInfo>;
  onUnsave: (sku: string) => void;
  onRemoveFromCompare: (sku: string) => void;
  onOpenSizeGuide: (sku: string) => void;
  onNotify: (sku: string) => void;
  onOpenProduct: (sku: string) => void;
}

/**
 * Compact swipeable carousel — one product's identity (image, brand,
 * price, rating, size) per slide, not the old full attribute-row card.
 * The comparison table below (AtAGlanceTable/DetailsTable) carries the
 * rest. Same drag mechanics as the deck this replaced: drag="x",
 * dragElastic 0.12, snap on velocity>500 or displacement>30%, spring
 * {stiffness:320, damping:34} — myntra-ui skill's motion spec, unchanged.
 */
export function CompareCarousel({
  products,
  index,
  onIndexChange,
  sizeInfoBySku,
  leaderBySku,
  onUnsave,
  onRemoveFromCompare,
  onOpenSizeGuide,
  onNotify,
  onOpenProduct,
}: CompareCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    function measure() {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (width > 0) animate(x, -index * width, SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width]);

  const dragConstraints = useMemo(
    () => ({ left: -(width * (products.length - 1)), right: 0 }),
    [width, products.length],
  );

  function goTo(next: number, method: "drag" | "tap" | "keyboard") {
    const clamped = Math.max(0, Math.min(products.length - 1, next));
    if (clamped !== index) {
      track("card_swiped", { fromIndex: index, toIndex: clamped, method });
      onIndexChange(clamped);
    } else if (width > 0) {
      animate(x, -index * width, SPRING);
    }
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = width * DISPLACEMENT_RATIO;
    if (info.velocity.x < -VELOCITY_THRESHOLD || info.offset.x < -threshold) {
      goTo(index + 1, "drag");
    } else if (info.velocity.x > VELOCITY_THRESHOLD || info.offset.x > threshold) {
      goTo(index - 1, "drag");
    } else {
      goTo(index, "drag");
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(index + 1, "keyboard");
      else if (e.key === "ArrowLeft") goTo(index - 1, "keyboard");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width]);

  return (
    <div ref={containerRef} data-testid="compare-carousel" className="relative mt-3 overflow-hidden px-9">
      {width > 0 && (
        <motion.div
          className="flex"
          style={{ x }}
          drag="x"
          dragElastic={0.12}
          dragConstraints={dragConstraints}
          onDragEnd={handleDragEnd}
        >
          {products.map((product, i) => {
            const leader = leaderBySku[product.id];
            const sizeInfo = sizeInfoBySku[product.id];
            return (
              <div
                key={product.id}
                data-card-active={i === index}
                className="flex shrink-0 flex-col items-center px-2 text-center"
                style={{ width }}
              >
                {/* Icons and leader chips share one row (flex, not absolute
                    positioning) so 0/1/2 chips can never collide with the
                    heart/X buttons regardless of how much text they hold —
                    the chip column just takes whatever space is left
                    between the two fixed-width icon buttons. */}
                <div className="flex w-[150px] items-start justify-between">
                  {/* 44x44 tap target (RULES E7/X.7) around a visually
                      smaller 36px circle — the hit area is generous, the
                      glyph stays compact enough for the 150px-wide row. */}
                  <button
                    type="button"
                    onClick={() => onUnsave(product.id)}
                    aria-label={`Remove ${product.brand} ${product.title} from wishlist`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-card">
                      <Heart className="h-3.5 w-3.5 fill-brand text-brand" />
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col items-center gap-0.5 whitespace-nowrap pt-1">
                    {leader?.lowestPrice && <LeaderChip>Lowest price</LeaderChip>}
                    {leader?.highestRated && <LeaderChip>Best rated</LeaderChip>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFromCompare(product.id)}
                    aria-label={`Remove ${product.brand} ${product.title} from this comparison`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-card">
                      <X className="h-3.5 w-3.5 text-ink-muted" />
                    </span>
                  </button>
                </div>
                <div className="relative mt-1 h-[130px] w-[110px]">
                  <Image
                    src={product.images[0]}
                    alt={`${product.brand} ${product.title}`}
                    fill
                    draggable={false}
                    sizes="110px"
                    className="rounded-lg object-cover"
                    priority={i === index}
                  />
                </div>
                <div className="mt-1 flex w-[130px] justify-between text-[8.5px] font-bold leading-tight text-ink-muted">
                  <span className="w-[52px]">Unsave</span>
                  <span className="w-[52px] text-right">Remove from compare</span>
                </div>

                <p className="mt-1.5 text-[15px] font-extrabold text-ink">{product.brand}</p>
                <p className="text-[12px] font-medium text-ink-muted">{product.title}</p>
                <RatingPill
                  rating={product.rating}
                  ratingCount={product.ratingCount}
                  className="mt-1.5 rounded-full bg-positive-tint px-2.5 py-1"
                />
                <div className="mt-2">
                  <PriceLine price={product.price} mrp={product.mrp} discountPct={product.discountPct} />
                </div>
                <SizeLine
                  recommendation={sizeInfo?.recommendation ?? null}
                  status={sizeInfo?.status ?? "loading"}
                  onOpenSizeGuide={() => onOpenSizeGuide(product.id)}
                  onNotify={() => onNotify(product.id)}
                />
                <Link
                  href={`/product/${product.id}`}
                  onClick={() => onOpenProduct(product.id)}
                  className="mt-2 min-h-11 rounded-lg px-2 py-2 text-[12px] font-bold text-brand-dark"
                >
                  See product
                </Link>
              </div>
            );
          })}
        </motion.div>
      )}

      {index > 0 && (
        <button
          type="button"
          aria-label="Previous item"
          onClick={() => goTo(index - 1, "tap")}
          className="absolute left-1 top-[95px] z-10 flex h-11 w-11 items-center justify-center"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-card">
            <ChevronLeft className="h-3.5 w-3.5 text-ink" />
          </span>
        </button>
      )}
      {index < products.length - 1 && (
        <button
          type="button"
          aria-label="Next item"
          onClick={() => goTo(index + 1, "tap")}
          className="absolute right-1 top-[95px] z-10 flex h-11 w-11 items-center justify-center"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-card">
            <ChevronRight className="h-3.5 w-3.5 text-ink" />
          </span>
        </button>
      )}
    </div>
  );
}
