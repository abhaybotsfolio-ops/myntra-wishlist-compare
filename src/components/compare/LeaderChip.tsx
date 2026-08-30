import { Badge } from "@/components/ui/Badge";

/**
 * A neutral, single-attribute factual marker — "Lowest price"/"Highest
 * rated" — never card-level, never ranking language. Satisfies RULES B3's
 * parenthetical exactly: attribute values may be visually compared as long
 * as nothing tells the user which item to pick.
 */
export function LeaderChip({ children }: { children: string }) {
  return (
    <Badge tone="neutral" dot={false} className="whitespace-nowrap">
      {children}
    </Badge>
  );
}
