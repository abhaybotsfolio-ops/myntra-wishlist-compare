import type { Product } from "../../../data/schema.ts";
import type { PickForYou } from "@/lib/pickForYou";

/**
 * DECISIONS.md D8: RULES B3 ("No automated winner... the app must never
 * tell the user which item to pick") is a hard, documented constraint —
 * this card is a direct, explicit operator override of it, not a
 * judgement call made on the app's own authority. Every reason shown is
 * computed from real deck data (price/rating/size availability), same
 * discipline as everywhere else in the app; the override is about
 * *whether* a verdict is shown, not a license to fabricate the reasoning
 * behind it.
 */
export function PickForYouCard({ pick, product }: { pick: PickForYou; product: Product }) {
  const sentence =
    pick.reasons.length === 0
      ? ""
      : pick.reasons.length === 1
        ? pick.reasons[0]
        : `${pick.reasons.slice(0, -1).join(", ")} and ${pick.reasons[pick.reasons.length - 1]}`;

  return (
    <div className="mx-4 mt-3 rounded-xl border border-brand-tint bg-gradient-to-br from-brand-tint to-surface p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-brand">Our pick for you</p>
      <h5 className="mt-1 text-[13.5px] font-extrabold text-ink">
        {product.brand} {product.title}
      </h5>
      {sentence && (
        <p className="mt-1 text-[11.5px] font-medium leading-snug text-ink-muted">
          {sentence.charAt(0).toUpperCase() + sentence.slice(1)}.
        </p>
      )}
    </div>
  );
}
