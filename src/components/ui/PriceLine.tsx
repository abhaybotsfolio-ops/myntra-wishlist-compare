/**
 * Discounted price -> struck MRP -> discount % in orange-red, in that
 * order, on one line. myntra-ui skill: "Get that price line right and
 * everything else reads as authentic." Never wraps.
 */
export function PriceLine({
  price,
  mrp,
  discountPct,
  className = "",
}: {
  price: number;
  mrp: number;
  discountPct: number;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span className="text-[14px] font-bold text-ink">₹{price.toLocaleString("en-IN")}</span>
      {discountPct > 0 && (
        <>
          <span className="text-[12px] text-ink-faint line-through">
            ₹{mrp.toLocaleString("en-IN")}
          </span>
          <span className="text-[12px] font-bold text-discount">{discountPct}% OFF</span>
        </>
      )}
    </div>
  );
}
