"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet: backdrop + panel, contained within the phone frame on
 * desktop the same way Toast is (fixed positioning, PhoneFrame establishes
 * the containing block). Closes on backdrop tap, Escape, or the X. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-ink/40"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute inset-x-0 bottom-0 max-h-[80%] overflow-y-auto rounded-t-2xl bg-surface pb-[calc(16px+env(safe-area-inset-bottom))] shadow-card outline-none"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
              <h2 className="text-[16px] font-bold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center text-ink-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-3">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
