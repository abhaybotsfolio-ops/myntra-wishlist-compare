import type { ReactNode } from "react";
import { BatteryFull, SignalHigh, Wifi } from "lucide-react";

/**
 * One layout, not two (myntra-ui skill, RULES.md §10). Below 768px this is
 * full-bleed — the real device chrome is the browser's. At 768px and above
 * the exact same tree renders inside a centred 390×844 device frame with a
 * simulated status bar, so a desktop viewer still reads it as a phone
 * screen rather than a stretched web page.
 *
 * The frame box gets an explicit (identity) `transform` on md+ — that is
 * not decorative, it makes the box a CSS containing block for its `fixed`
 * descendants (Toast, Sheet), so overlays stay clipped to the phone frame
 * on desktop instead of floating over the whole browser window. Below
 * md, no transform is applied, so `fixed` means the real viewport, which
 * *is* the frame there.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas md:flex md:min-h-dvh md:items-center md:justify-center md:p-8">
      <div
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-canvas
          md:h-[844px] md:w-[390px] md:rounded-[44px] md:border-[10px]
          md:border-[#1c1c1e] md:shadow-2xl md:[transform:translateZ(0)]"
      >
        <StatusBar />
        <main
          id="app-scroll"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div
      aria-hidden="true"
      className="hidden h-11 shrink-0 items-center justify-between bg-canvas px-6 text-[15px] font-semibold text-ink md:flex"
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5 text-ink">
        <SignalHigh className="h-3.5 w-3.5" strokeWidth={2.5} />
        <Wifi className="h-3.5 w-3.5" strokeWidth={2.5} />
        <BatteryFull className="h-4 w-4" strokeWidth={2} />
      </div>
    </div>
  );
}
