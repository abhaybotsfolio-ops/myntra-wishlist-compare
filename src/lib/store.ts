"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PRODUCTS, SIZE_PROFILE } from "./catalog";
import { SELECTION_MAX, SELECTION_MIN, type Category } from "./constants";
import { track, setTrackAppender, capRingBuffer, type LoggedEvent } from "./track";
import { showToast } from "./toast-bus";
import type { SizeProfile } from "../../data/schema.ts";

export type ViewCategory = "all" | Category;
export type Mode = "browse" | "selecting";

// The demo's premise is a shopper who already has a wishlist (CLAUDE.md §2:
// "No changes to how items are added to the wishlist") — so the default
// state is the full seeded catalog, most-recently-saved first, not empty.
// Computed once at module scope so server and client agree before any
// sessionStorage rehydration happens (see skipHydration below).
const DEFAULT_WISHLIST: string[] = [...PRODUCTS]
  .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  .map((p) => p.id);

interface RemoveResult {
  deckBelowMin: boolean;
  remaining: number;
}

interface AppState {
  wishlist: string[];
  activeCategory: ViewCategory;
  mode: Mode;
  selection: string[];
  deck: string[];
  deckIndex: number;
  deckStartedAt: number | null;
  bag: string[];
  sizeProfile: SizeProfile;
  events: LoggedEvent[];
  hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  setActiveCategory: (c: ViewCategory) => void;
  enterSelectionMode: () => void;
  cancelSelectionMode: () => void;
  toggleSelection: (sku: string) => void;
  confirmSelection: () => string[] | null;
  setDeckIndex: (i: number) => void;
  removeItem: (sku: string, fromSurface: string) => RemoveResult;
  addToBag: (sku: string, fromSurface: string, dwellMs: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      wishlist: DEFAULT_WISHLIST,
      activeCategory: "all",
      mode: "browse",
      selection: [],
      deck: [],
      deckIndex: 0,
      deckStartedAt: null,
      bag: [],
      sizeProfile: SIZE_PROFILE,
      events: [],
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      setActiveCategory: (c) => set({ activeCategory: c }),

      enterSelectionMode: () => set({ mode: "selecting", selection: [] }),

      cancelSelectionMode: () => set({ mode: "browse", selection: [] }),

      toggleSelection: (sku) => {
        const { selection } = get();
        if (selection.includes(sku)) {
          const next = selection.filter((s) => s !== sku);
          set({ selection: next });
          track("selection_changed", { count: next.length, sku, action: "deselect" });
          return;
        }
        if (selection.length >= SELECTION_MAX) {
          track("selection_limit_hit", { attemptedSku: sku });
          showToast(`You can compare up to ${SELECTION_MAX} items at a time`, { tone: "warning" });
          return;
        }
        const next = [...selection, sku];
        set({ selection: next });
        track("selection_changed", { count: next.length, sku, action: "select" });
      },

      confirmSelection: () => {
        const { selection } = get();
        if (selection.length < SELECTION_MIN) return null;
        set({
          deck: [...selection],
          deckIndex: 0,
          deckStartedAt: Date.now(),
          mode: "browse",
          selection: [],
        });
        track("comparison_started", { skus: selection, count: selection.length });
        return selection;
      },

      setDeckIndex: (i) => set({ deckIndex: i }),

      removeItem: (sku, fromSurface) => {
        const { wishlist, deck, deckIndex, selection } = get();
        const wasInDeck = deck.includes(sku);
        const removedIndex = deck.indexOf(sku);
        const newWishlist = wishlist.filter((id) => id !== sku);
        const newDeck = deck.filter((id) => id !== sku);
        const newSelection = selection.filter((id) => id !== sku);
        let newDeckIndex = deckIndex;
        if (wasInDeck) {
          if (removedIndex < deckIndex) newDeckIndex -= 1;
          newDeckIndex = Math.min(newDeckIndex, Math.max(newDeck.length - 1, 0));
        }
        set({
          wishlist: newWishlist,
          deck: newDeck,
          deckIndex: newDeckIndex,
          selection: newSelection,
        });
        track("remove_from_wishlist", { sku, fromSurface, remaining: newWishlist.length });
        return { deckBelowMin: wasInDeck && newDeck.length < SELECTION_MIN, remaining: newDeck.length };
      },

      addToBag: (sku, fromSurface, dwellMs) => {
        const { bag } = get();
        if (!bag.includes(sku)) set({ bag: [...bag, sku] });
        track("add_to_bag", { sku, fromSurface, dwellMs });
      },
    }),
    {
      name: "myntra-compare-session",
      storage: createJSONStorage(() => sessionStorage),
      // Session, not local (ARCHITECTURE §4) — a new tab is a new session,
      // matching the PRD's "backgrounds the app and returns" wording.
      partialize: (s) => ({
        wishlist: s.wishlist,
        activeCategory: s.activeCategory,
        mode: s.mode,
        selection: s.selection,
        deck: s.deck,
        deckIndex: s.deckIndex,
        deckStartedAt: s.deckStartedAt,
        bag: s.bag,
        events: s.events,
      }),
      // Hydrate manually (see StoreHydration in components/ui) so the
      // server-rendered HTML and the client's pre-hydration render always
      // agree on DEFAULT_WISHLIST before sessionStorage is consulted.
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useAppStore.setState({ hasHydrated: true });
      },
    },
  ),
);

setTrackAppender((e) => {
  useAppStore.setState((s) => ({ events: capRingBuffer([...s.events, e]) }));
});

// ---------------------------------------------------------------------------
// Derived selectors — never stored, always computed (ARCHITECTURE §4: storing
// these creates the class of bug where a stale count survives a mutation).
// ---------------------------------------------------------------------------

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function filterByCategory(ids: string[], category: ViewCategory): string[] {
  if (category === "all") return ids;
  return ids.filter((id) => PRODUCTS_BY_ID.get(id)?.category === category);
}

export function canCompare(eligibleCount: number): boolean {
  return eligibleCount >= SELECTION_MIN;
}
