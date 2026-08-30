import type { ReactNode } from "react";
import type { DeckStats } from "@/lib/compareStats";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Rendered exactly once, above the swipeable deck — not per card, not
 * repeated on swipe. Pure spread facts about the selected set (a range,
 * a count), never a ranking or a pick — see RULES B3. Unlike the
 * per-card ATTRIBUTE_ROWS mechanic, this has no cross-card alignment
 * invariant to protect (there's only one instance on the page), so it's
 * an ordinary min-height block, no data-row participation.
 */
export function SummaryStrip({ stats }: { stats: DeckStats }) {
  return (
    <div
      data-testid="summary-strip"
      className="mx-3 mb-2 flex items-center justify-around gap-2 rounded-lg border border-line bg-surface px-3 py-2.5"
    >
      <Stat label="Price">{formatRange(stats.priceMin, stats.priceMax, (n) => `₹${n.toLocaleString("en-IN")}`)}</Stat>
      <Divider />
      <Stat label="Rating">
        {formatRange(stats.ratingMin, stats.ratingMax, (n) => n.toFixed(1))} ★
      </Stat>
      {stats.inSizeCount !== null && (
        <>
          <Divider />
          <Stat label="In your size">
            {stats.inSizeLoading ? (
              <Skeleton className="h-[15px] w-10" />
            ) : (
              // Deliberately "N/M", not "N of M" — PositionIndicator's card
              // position ("2 of 3") uses that exact phrase, and this stat
              // can coincidentally land on the same numbers in the same
              // deck; a distinct format keeps the two never string-equal.
              `${stats.inSizeCount}/${stats.inSizeTotal}`
            )}
          </Stat>
        </>
      )}
    </div>
  );
}

function formatRange(min: number, max: number, format: (n: number) => string): string {
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <span className="text-[13px] font-bold text-ink">{children}</span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-7 w-px bg-line" />;
}
