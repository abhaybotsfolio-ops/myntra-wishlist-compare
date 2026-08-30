import { Star } from "lucide-react";

/**
 * "4.1 ★ | 2841" — the Myntra rating pattern, used exactly. `compact` drops
 * the divider and count for tight spaces (the wishlist tile's image-overlay
 * badge) — same rating value, same visual language, just the score.
 */
export function RatingPill({
  rating,
  ratingCount,
  compact = false,
  className = "",
}: {
  rating: number;
  ratingCount: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 text-[12px] font-bold text-ink ${className}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {rating.toFixed(1)}
        <Star className="h-3 w-3 fill-positive text-positive" />
      </span>
      {!compact && (
        <>
          <span className="text-ink-faint" aria-hidden="true">
            |
          </span>
          <span className="font-normal text-ink-faint">{ratingCount.toLocaleString("en-IN")}</span>
        </>
      )}
    </div>
  );
}
