/**
 * A per-card label — up to 2, from the 5-label set computed by
 * computeDeckStats (D11: BEST VALUE, BEST RATED, BEST FIT FOR YOU, LOWEST
 * PRICE, FASTEST DELIVERY). LOWEST PRICE/BEST RATED/FASTEST DELIVERY are
 * neutral single-attribute markers within RULES B3's parenthetical; BEST
 * VALUE and BEST FIT FOR YOU are an operator-directed extension of the D8
 * override (RULES B3 names "Best value" as a banned example — the operator
 * asked for it explicitly, see DECISIONS.md D11).
 *
 * Deliberately not the shared Badge component: the longest labels ("BEST
 * FIT FOR YOU", "FASTEST DELIVERY") don't fit Badge's 12px/nowrap sizing
 * in the carousel header's ~62px-wide chip column, so this needs its own
 * smaller, wrapping, center-aligned sizing rather than fighting Badge's
 * base classes via a className override.
 */
export function LeaderChip({ children }: { children: string }) {
  return (
    <span className="inline-block max-w-[68px] rounded-full bg-canvas px-1.5 py-0.5 text-center text-[7.5px] font-bold uppercase leading-tight tracking-tight text-ink">
      {children}
    </span>
  );
}
