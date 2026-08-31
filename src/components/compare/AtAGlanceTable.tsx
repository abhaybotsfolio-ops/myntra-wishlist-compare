"use client";

import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { Product } from "../../../data/schema.ts";
import type { AvailabilityStatus, SizeRecommendation } from "@/lib/size";

interface SizeInfo {
  recommendation: SizeRecommendation | null;
  status: AvailabilityStatus | "loading";
}

/**
 * The reference prototype's "At a glance" table — real per-item values
 * side by side, not the range-summary strip it replaces. A CSS grid
 * guarantees column alignment natively, so there's no equivalent of the
 * old ATTRIBUTE_ROWS/data-row pixel-alignment mechanic to maintain here
 * (DECISIONS.md D8). The column matching the carousel's centered card gets
 * a pink-tint highlight, same as the reference. `data-row`/`data-cell`
 * carry the row/row+sku identity for tests, filling the same role the old
 * per-card `data-row` attribute used to.
 */
export function AtAGlanceTable({
  products,
  activeIndex,
  sizeInfoBySku,
}: {
  products: Product[];
  activeIndex: number;
  sizeInfoBySku: Record<string, SizeInfo>;
}) {
  const cols = `72px repeat(${products.length}, 1fr)`;

  return (
    <div data-testid="at-a-glance-table" className="mx-4 mt-3 rounded-xl border border-line bg-surface p-3.5">
      <h4 className="mb-2.5 text-[12.5px] font-extrabold text-ink">At a glance</h4>
      <Row rowKey="price" cols={cols} label="Price" products={products} activeIndex={activeIndex}>
        {(p) => `₹${p.price.toLocaleString("en-IN")}`}
      </Row>
      <Row rowKey="rating" cols={cols} label="Rating" products={products} activeIndex={activeIndex}>
        {(p) => `${p.rating.toFixed(1)}★`}
      </Row>
      <Row rowKey="size" cols={cols} label="AI size" products={products} activeIndex={activeIndex}>
        {(p) => {
          const info = sizeInfoBySku[p.id];
          if (!info?.recommendation) return <span className="text-ink-faint">—</span>;
          if (info.status === "loading") return <span className="text-ink-faint">…</span>;
          return info.status === "unavailable" ? (
            <X className="mx-auto h-3.5 w-3.5 text-negative" aria-label="Not available" />
          ) : (
            <Check className="mx-auto h-3.5 w-3.5 text-positive-text" aria-label="Available" />
          );
        }}
      </Row>
      <Row rowKey="delivery" cols={cols} label="Delivery" products={products} activeIndex={activeIndex} last>
        {(p) => p.deliveryEstimate.replace(/^Delivery by /, "")}
      </Row>
    </div>
  );
}

function Row({
  rowKey,
  cols,
  label,
  products,
  activeIndex,
  last,
  children,
}: {
  rowKey: string;
  cols: string;
  label: string;
  products: Product[];
  activeIndex: number;
  last?: boolean;
  children: (p: Product) => ReactNode;
}) {
  return (
    <div
      data-row={rowKey}
      className={`grid items-center py-1.5 ${last ? "" : "border-b border-line"}`}
      style={{ gridTemplateColumns: cols }}
    >
      <span className="text-[11px] font-semibold text-ink-muted">{label}</span>
      {products.map((p, i) => (
        <span
          key={p.id}
          data-cell={`${rowKey}:${p.id}`}
          className={`rounded-md py-1 text-center text-[12px] font-bold text-ink ${
            i === activeIndex ? "bg-brand-tint" : ""
          }`}
        >
          {children(p)}
        </span>
      ))}
    </div>
  );
}
