"use client";

import { Button } from "@/components/ui/Button";
import { SELECTION_MIN } from "@/lib/constants";

/** R2: fixed bottom bar, live count ("Compare 3"), disabled below the
 * minimum, Cancel to its left. myntra-ui skill: 56px, full-width brand
 * button. */
export function StickyCompareBar({
  count,
  onConfirm,
  onCancel,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const disabled = count < SELECTION_MIN;
  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
      <Button variant="subtle" onClick={onCancel} className="shrink-0 px-2">
        Cancel
      </Button>
      <Button variant="primary" fullWidth disabled={disabled} onClick={onConfirm} className="h-14">
        {count === 0 ? "Select items to compare" : `Compare ${count}`}
      </Button>
    </div>
  );
}
