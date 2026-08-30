"use client";

import { Button, Reason } from "@/components/ui/Button";
import type { ViewCategory } from "@/lib/store";
import { SELECTION_MIN } from "@/lib/constants";

/**
 * R1: a "Compare" button at the top of the wishlist when viewing a single
 * category; disabled (not hidden — Phase 3 gate: "a reviewer needs to see
 * that the rule exists") on the combined "All Items" view, and disabled
 * when the active category has fewer than 2 items, each with its own
 * visible reason (ACCEPTANCE 1.3).
 */
export function CompareCTA({
  activeCategory,
  eligibleCount,
  onCompare,
}: {
  activeCategory: ViewCategory;
  eligibleCount: number;
  onCompare: () => void;
}) {
  const reason =
    activeCategory === "all"
      ? "Select Shirts or Pants to compare items"
      : eligibleCount < SELECTION_MIN
        ? `Save at least ${SELECTION_MIN} items in this category to compare`
        : null;

  return (
    <div className="flex flex-col items-start gap-1 px-4 pt-3">
      <Button variant="primary" disabled={!!reason} onClick={onCompare}>
        Compare
      </Button>
      {reason && <Reason>{reason}</Reason>}
    </div>
  );
}
