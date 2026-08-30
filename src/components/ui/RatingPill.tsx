import { Star } from "lucide-react";

/** "4.1 ★ | 2841" — the Myntra rating pattern, used exactly. */
export function RatingPill({
  rating,
  ratingCount,
  className = "",
}: {
  rating: number;
  ratingCount: number;
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
      <span className="text-ink-faint" aria-hidden="true">
        |
      </span>
      <span className="font-normal text-ink-faint">{ratingCount.toLocaleString("en-IN")}</span>
    </div>
  );
}
