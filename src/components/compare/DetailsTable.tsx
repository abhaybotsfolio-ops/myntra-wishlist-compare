"use client";

import type { ReactNode } from "react";
import type { Product } from "../../../data/schema.ts";
import { RETURN_POLICY } from "@/lib/constants";

/**
 * The reference prototype's "Why you might choose this" table — real,
 * already-modeled per-item fields (fit, material) plus one platform-wide
 * fact (returns — D12) shown identically in every column since it isn't a
 * per-SKU signal in this catalog. The prototype also shows
 * colour/occasion/key-features rows, none of which exist in this app's
 * Product schema; inventing shallow one-line values for them to match the
 * reference more literally would be exactly the kind of fabrication
 * RULES.md polices elsewhere (never a guessed size, a fabricated review
 * theme) — so those rows stay left out. See DECISIONS.md D8. The
 * offered-sizes list (was a third row here) was dropped per D11 — the
 * shopper's own AI-recommended size (SizeLine, AtAGlanceTable) is the
 * actionable fact; a full "XS S M L XL" list added noise without
 * answering "can I wear this."
 */
export function DetailsTable({ products, activeIndex }: { products: Product[]; activeIndex: number }) {
  const cols = `72px repeat(${products.length}, 1fr)`;

  return (
    <div data-testid="details-table" className="mx-4 mt-3 rounded-xl border border-line bg-surface p-3.5">
      <h4 className="mb-2.5 text-[12.5px] font-extrabold text-ink">Why you might choose this</h4>
      <Row rowKey="fit" cols={cols} label="Fit" products={products} activeIndex={activeIndex}>
        {(p) => p.fit}
      </Row>
      <Row rowKey="material" cols={cols} label="Material" products={products} activeIndex={activeIndex}>
        {(p) => p.material}
      </Row>
      <Row rowKey="returns" cols={cols} label="Returns" products={products} activeIndex={activeIndex} last>
        {() => RETURN_POLICY}
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
      className={`grid items-center py-2 ${last ? "" : "border-b border-line"}`}
      style={{ gridTemplateColumns: cols }}
    >
      <span className="text-[10.5px] font-semibold text-ink-muted">{label}</span>
      {products.map((p, i) => (
        <span
          key={p.id}
          data-cell={`${rowKey}:${p.id}`}
          className={`rounded-md px-0.5 py-1 text-center text-[10.5px] font-semibold leading-snug text-ink ${
            i === activeIndex ? "bg-brand-tint" : ""
          }`}
        >
          {children(p)}
        </span>
      ))}
    </div>
  );
}
