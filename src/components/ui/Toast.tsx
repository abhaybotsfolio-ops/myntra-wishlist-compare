"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { subscribeToast, type ToastMessage } from "@/lib/toast-bus";

const TONE_CLASSES: Record<ToastMessage["tone"], string> = {
  neutral: "bg-ink text-white",
  warning: "bg-warning text-white",
  negative: "bg-negative text-white",
};

function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => remove(toast.id), toast.durationMs);
    });
  }, [remove]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            role="status"
            className={`pointer-events-auto max-w-[320px] rounded-lg px-4 py-3 text-center text-[13px] font-medium shadow-card ${TONE_CLASSES[t.tone]}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Mount once, at the root. Anything anywhere can raise a toast via
 * `showToast()` from lib/toast-bus — no context consumer needed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
