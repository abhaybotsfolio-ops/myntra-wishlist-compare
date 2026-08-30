import type { ReactNode } from "react";

type BadgeTone = "brand" | "positive" | "warning" | "negative" | "neutral";

const TONE_BG: Record<BadgeTone, string> = {
  brand: "bg-brand-tint",
  positive: "bg-positive/10",
  warning: "bg-warning/15",
  negative: "bg-negative/10",
  neutral: "bg-canvas",
};

const TONE_DOT: Record<BadgeTone, string> = {
  brand: "bg-brand",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  neutral: "bg-ink-faint",
};

/**
 * A tinted pill. Text always renders in `--color-ink` regardless of tone —
 * meaning is carried by the label and the leading dot, not by colored text,
 * which is what keeps this readable at 12px against the Lighthouse
 * accessibility contrast bar (ACCEPTANCE X.8).
 */
export function Badge({
  tone = "neutral",
  dot = true,
  children,
  className = "",
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold text-ink ${TONE_BG[tone]} ${className}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-[6px] w-[6px] shrink-0 rounded-full ${TONE_DOT[tone]}`}
        />
      )}
      {children}
    </span>
  );
}
