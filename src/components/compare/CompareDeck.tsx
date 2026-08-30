"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "../../../data/schema.ts";
import { CompareCard } from "@/components/compare/CompareCard";
import { track } from "@/lib/track";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34 };
const VELOCITY_THRESHOLD = 500;
const DISPLACEMENT_RATIO = 0.3;

interface CompareDeckProps {
  products: Product[];
  index: number;
  onIndexChange: (i: number) => void;
  bag: string[];
  onAddToBag: (sku: string, dwellMs: number) => void;
  onRemove: (sku: string) => void;
  onOpenProduct: (sku: string) => void;
}

/**
 * myntra-ui skill: drag="x", dragElastic 0.12, snap on velocity >500 or
 * displacement >30% of card width, spring {stiffness:320, damping:34}.
 * All cards render simultaneously in one flex row (not mount/unmount per
 * index) so drag-follow is continuous and card state (e.g. dwell timers)
 * survives swiping back and forth.
 */
export function CompareDeck({
  products,
  index,
  onIndexChange,
  bag,
  onAddToBag,
  onRemove,
  onOpenProduct,
}: CompareDeckProps) {
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

  function goTo(next: number, method: "drag" | "tap" | "keyboard") {
    const clamped = Math.max(0, Math.min(products.length - 1, next));
    if (clamped !== index) {
      track("card_swiped", { fromIndex: index, toIndex: clamped, method });
      onIndexChange(clamped);
    } else if (width > 0) {
      animate(x, -index * width, SPRING); // rubber-band back
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
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden px-3">
      {width > 0 && (
        <motion.div
          className="flex h-full"
          style={{ x }}
          drag="x"
          dragElastic={0.12}
          dragConstraints={{ left: -(width * (products.length - 1)), right: 0 }}
          onDragEnd={handleDragEnd}
        >
          {products.map((product, i) => (
            <div key={product.id} className="h-full shrink-0 px-1" style={{ width }}>
              <CompareCard
                product={product}
                isActive={i === index}
                bagged={bag.includes(product.id)}
                onAddToBag={(dwellMs) => onAddToBag(product.id, dwellMs)}
                onRemove={() => onRemove(product.id)}
                onOpenProduct={() => onOpenProduct(product.id)}
              />
            </div>
          ))}
        </motion.div>
      )}

      {index > 0 && (
        <button
          type="button"
          aria-label="Previous item"
          onClick={() => goTo(index - 1, "tap")}
          className="absolute left-0 top-0 z-10 flex h-full w-8 items-center justify-start text-ink-faint"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {index < products.length - 1 && (
        <button
          type="button"
          aria-label="Next item"
          onClick={() => goTo(index + 1, "tap")}
          className="absolute right-0 top-0 z-10 flex h-full w-8 items-center justify-end text-ink-faint"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
