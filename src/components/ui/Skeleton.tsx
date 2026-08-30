/**
 * Fixed-size placeholder. Always given an explicit height by the caller so
 * swapping it for real content never shifts layout (RULES D2/E2) — this is
 * what backs the reviews-row skeleton in R5 and the image fallback in R4/R6.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded-md bg-line ${className}`}
    />
  );
}

export function SkeletonText({
  lines = 2,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}
