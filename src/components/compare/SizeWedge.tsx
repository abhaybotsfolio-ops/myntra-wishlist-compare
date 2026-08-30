"use client";

import { ChevronRight } from "lucide-react";
import type { AvailabilityStatus, SizeRecommendation } from "@/lib/size";
import { Skeleton } from "@/components/ui/Skeleton";

interface SizeWedgeProps {
  recommendation: SizeRecommendation | null;
  // "loading" only while /api/inventory hasn't resolved yet — distinct from
  // "no recommendation" (which needs no inventory at all, and renders
  // immediately) so a no-signal brand never gets stuck on a skeleton.
  status: AvailabilityStatus | "loading";
  onTap: () => void;
}

const STATUS_TINT: Record<AvailabilityStatus, string> = {
  available: "bg-positive/8 border-positive/25",
  low: "bg-warning/10 border-warning/30",
  unavailable: "bg-negative/8 border-negative/25",
};

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: "In stock",
  low: "Only 2 left",
  unavailable: "Out of stock",
};

/**
 * myntra-ui/size-wedge skill: the load-bearing 76px row. Four variants —
 * available/low/unavailable/no-signal — all the same height, the whole
 * block is a tap target (not just the chevron), and the no-signal branch
 * never fabricates a size (RULES C3).
 */
export function SizeWedge({ recommendation, status, onTap }: SizeWedgeProps) {
  if (!recommendation) {
    return (
      <button
        type="button"
        onClick={onTap}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2 text-left transition-colors"
      >
        <div>
          <p className="text-[14px] font-bold text-ink">Size guide</p>
          <p className="text-[11px] text-ink-faint">
            We don&apos;t have your size history for this brand
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>
    );
  }

  if (status === "loading") {
    return <Skeleton className="h-[52px] w-full rounded-lg" />;
  }

  return (
    <button
      type="button"
      onClick={onTap}
      className={`flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${STATUS_TINT[status]}`}
    >
      <p className="text-[14px] font-bold text-ink">
        Your size: {recommendation.size} · {STATUS_LABEL[status]}
      </p>
      <p className="text-[11px] text-ink-faint">{recommendation.basis}</p>
    </button>
  );
}
