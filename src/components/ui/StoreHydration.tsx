"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Triggers the store's sessionStorage rehydration exactly once, after
 * mount. Paired with `skipHydration: true` in lib/store.ts so the server
 * render and the client's first paint always agree on DEFAULT_WISHLIST —
 * only after that has committed do we swap in whatever this session
 * already had (a returning-within-tab visit). Renders nothing.
 */
export function StoreHydration() {
  useEffect(() => {
    useAppStore.persist.rehydrate();
  }, []);
  return null;
}
