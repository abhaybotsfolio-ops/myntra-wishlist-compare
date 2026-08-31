"use client";

import { Check, ChevronRight, X } from "lucide-react";
import type { AvailabilityStatus, SizeRecommendation } from "@/lib/size";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Compact replacement for the old full-height SizeWedge, sized for the
 * carousel slide. Same four states, same honesty rule (RULES C3 — never a
 * guessed size, the basis string always renders when there's a
 * recommendation at all) — just laid out for a ~150px-wide slide instead
 * of a 76px full-width row. Always wrapped in the same
 * data-testid="size-line" element regardless of branch, so tests (and
 * anything sweeping "is every card's size area non-empty") have one
 * consistent hook.
 */
export function SizeLine({
  recommendation,
  status,
  onOpenSizeGuide,
  onNotify,
}: {
  recommendation: SizeRecommendation | null;
  status: AvailabilityStatus | "loading";
  onOpenSizeGuide: () => void;
  onNotify: () => void;
}) {
  if (!recommendation) {
    return (
      <div data-testid="size-line" className="mt-2">
        <button
          type="button"
          onClick={onOpenSizeGuide}
          className="flex items-center gap-0.5 text-[12px] font-semibold text-ink-muted"
        >
          Size guide
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div data-testid="size-line" className="mt-2">
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div data-testid="size-line" className="mt-2 flex flex-col items-center gap-0.5">
        <p className="flex items-center gap-1 text-[12px] font-bold text-negative">
          <X className="h-3.5 w-3.5" /> AI-recommended size {recommendation.size} out of stock
        </p>
        {/* RULES C3 — the basis always shows alongside a recommendation,
            regardless of stock status; dropping it here was a real
            regression found while rewriting the acceptance suite. */}
        <p className="text-[10px] text-ink-faint">{recommendation.basis}</p>
        <button
          type="button"
          onClick={onNotify}
          className="text-[11px] font-bold text-brand underline-offset-2 hover:underline"
        >
          Notify me when {recommendation.size} is back
        </button>
      </div>
    );
  }

  const label = status === "low" ? "only a few left" : "available";
  return (
    <div data-testid="size-line" className="mt-2 flex flex-col items-center gap-0.5">
      <p className="flex items-center gap-1 text-[12px] font-bold text-positive-text">
        <Check className="h-3.5 w-3.5" /> AI-recommended size {recommendation.size} · {label}
      </p>
      <p className="text-[10px] text-ink-faint">{recommendation.basis}</p>
    </div>
  );
}
