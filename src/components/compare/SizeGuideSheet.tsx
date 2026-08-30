"use client";

import { Sheet } from "@/components/ui/Sheet";
import { SIZE_GUIDE } from "@/lib/size";
import type { Category } from "@/lib/constants";

/** size-wedge skill: "a real chart with chest/waist measurements, not a
 * placeholder" — this is what the no-signal wedge opens. */
export function SizeGuideSheet({
  open,
  onClose,
  category,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  category: Category;
  brand: string;
}) {
  const guide = SIZE_GUIDE[category];
  return (
    <Sheet open={open} onClose={onClose} title={`Size guide — ${brand}`}>
      <p className="pb-3 text-[12px] text-ink-muted">
        General {category} sizing, measurements in {guide.unit === "in" ? "inches" : guide.unit}
        . We don&apos;t have a size history for {brand} yet, so this is the standard chart
        rather than a personal recommendation.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {guide.columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-line px-2 py-2 text-left font-semibold text-ink-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={`border-b border-line px-2 py-2 ${
                      i === 0 ? "font-bold text-ink" : "text-ink-muted"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
