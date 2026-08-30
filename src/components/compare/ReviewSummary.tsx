"use client";

import { useEffect, useRef } from "react";
import type { Summary, Theme } from "../../../data/schema.ts";
import { track } from "@/lib/track";
import { SkeletonText } from "@/components/ui/Skeleton";

const DOT_COLOR: Record<Theme["sentiment"], string> = {
  positive: "bg-positive",
  mixed: "bg-warning",
  negative: "bg-negative",
};

/**
 * myntra-ui skill: each theme is a stacked pair (label 13/600 ink, detail
 * 12/400 muted) with a 4px sentiment dot before the label; "from N
 * reviews" underneath in faint 11/400. RULES D1: a failed summarisation
 * renders the fallback and says nothing about it — `source` is never
 * displayed, only logged via summary_rendered.
 */
export function ReviewSummary({ sku, summary }: { sku: string; summary: Summary | undefined }) {
  const rendered = useRef(false);

  useEffect(() => {
    if (!summary || rendered.current) return;
    rendered.current = true;
    track("summary_rendered", {
      sku,
      source: summary.source,
      themeCount: summary.themes.length,
      hasNegative: summary.themes.some((t) => t.sentiment !== "positive"),
    });
  }, [sku, summary]);

  if (!summary) {
    return <SkeletonText lines={3} />;
  }

  if (summary.status === "insufficient_reviews") {
    return <p className="text-[13px] text-ink-faint">Not enough reviews yet</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {summary.themes.map((theme, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${DOT_COLOR[theme.sentiment]}`}
          />
          <div>
            <p className="text-[13px] font-semibold text-ink">{theme.label}</p>
            <p className="text-[12px] text-ink-muted">{theme.detail}</p>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-ink-faint">from {summary.basedOn} reviews</p>
    </div>
  );
}
