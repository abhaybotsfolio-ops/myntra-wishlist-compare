/**
 * Analytics — a single track() into a session-scoped in-memory ring buffer
 * plus console.debug. No SDK (RULES F6). The event names and payloads below
 * are fixed by docs/ARCHITECTURE.md §7 and map one-to-one onto the PRD §7
 * success metrics — this is deliberately not extensible from call sites.
 */

export type AnalyticsEvent =
  | { name: "wishlist_viewed"; payload: { category: string; itemCount: number } }
  | { name: "compare_tapped"; payload: { category: string; eligibleCount: number } }
  | { name: "selection_changed"; payload: { count: number; sku: string; action: "select" | "deselect" } }
  | { name: "selection_limit_hit"; payload: { attemptedSku: string } }
  | { name: "comparison_started"; payload: { skus: string[]; count: number } }
  | { name: "card_swiped"; payload: { fromIndex: number; toIndex: number; method: "drag" | "tap" | "keyboard" } }
  | { name: "size_wedge_viewed"; payload: { sku: string; status: string; hasSignal: boolean } }
  | { name: "size_wedge_tapped"; payload: { sku: string; status: string } }
  | { name: "stock_changed_in_session"; payload: { sku: string; size: string; from: number; to: number } }
  | { name: "summary_rendered"; payload: { sku: string; source: "llm" | "fallback"; themeCount: number; hasNegative: boolean } }
  | { name: "add_to_bag"; payload: { sku: string; fromSurface: string; dwellMs: number } }
  | { name: "remove_from_wishlist"; payload: { sku: string; fromSurface: string; remaining: number } }
  | { name: "pdp_opened"; payload: { sku: string; fromSurface: string } }
  | { name: "comparison_exited"; payload: { reason: string; durationMs: number; swipes: number; decided: boolean } };

export type AnalyticsEventName = AnalyticsEvent["name"];
export type PayloadFor<N extends AnalyticsEventName> = Extract<AnalyticsEvent, { name: N }>["payload"];

export interface LoggedEvent {
  name: AnalyticsEventName;
  payload: Record<string, unknown>;
  at: number;
}

const RING_CAP = 200;

/** The store injects its own appender (so events live in the same
 * persisted slice as everything else); this module works standalone
 * (console.debug only) until that's wired, so early calls never throw. */
let appender: ((e: LoggedEvent) => void) | null = null;
export function setTrackAppender(fn: (e: LoggedEvent) => void) {
  appender = fn;
}

export function track<N extends AnalyticsEventName>(name: N, payload: PayloadFor<N>): void {
  const event: LoggedEvent = { name, payload, at: Date.now() };
  console.debug("[track]", name, payload);
  appender?.(event);
}

export function capRingBuffer(events: LoggedEvent[]): LoggedEvent[] {
  return events.length > RING_CAP ? events.slice(events.length - RING_CAP) : events;
}
