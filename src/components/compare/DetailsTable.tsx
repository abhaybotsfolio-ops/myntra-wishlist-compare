"use client";

import type { ReactNode } from "react";
import type { Product } from "../../../data/schema.ts";

/**
 * The reference prototype's "Why you might choose this" table — only real,
 * already-modeled fields (fit, material, offered sizes). The prototype
 * also shows colour/occasion/key-features/returns rows, none of which
 * exist in this app's Product schema; inventing shallow one-line values
 * for them to match the reference more literally would be exactly the
 * kind of fabrication RULES.md polices elsewhere (never a guessed size, a
 * fabricated review theme) — so those rows were left out rather than
 * invented. See DECISIONS.md D8.
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
      <Row rowKey="sizes" cols={cols} label="Sizes" products={products} activeIndex={activeIndex} last>
        {(p) => p.sizes.join(", ")}
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
