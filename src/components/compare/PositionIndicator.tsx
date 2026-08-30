/** R3: dots + "N of M" text, both always visible (ACCEPTANCE 3.4). */
export function PositionIndicator({ index, count }: { index: number; count: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === index ? "w-4 bg-brand" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>
      <span className="text-[12px] font-semibold text-ink-muted">
        {index + 1} of {count}
      </span>
    </div>
  );
}
