import { Layers } from "lucide-react";

/**
 * Occupies the banner slot the real Myntra wishlist uses for a cashback/
 * coupon promo — RULES B2 forbids that content here, so this explains the
 * Compare feature itself instead of any offer. Static, non-interactive.
 * Only shown when there's something to compare (RULES B5's floor of 2).
 */
export function CompareIntroBanner() {
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg bg-brand-tint px-4 py-3">
      <Layers className="h-5 w-5 shrink-0 text-brand-dark" aria-hidden="true" />
      <p className="text-[12px] leading-snug text-ink-muted">
        <span className="font-semibold text-ink">Comparing made easy.</span> Select 2–4 saved
        items in one category to see them side by side.
      </p>
    </div>
  );
}
