import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { ToastProvider } from "@/components/ui/Toast";
import { StoreHydration } from "@/components/ui/StoreHydration";

// Self-hosted at build time (next/font/google downloads once during `next
// build`/`next dev`, then serves from this app's own origin) — no runtime
// call to Google's font CDN, so this doesn't add an external dependency at
// request time (RULES D4). Matches the reference prototype's typeface.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wishlist — Myntra",
  description:
    "Compare saved Shirts and Pants side by side — price, fit, size availability and what other buyers said.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable lock — that disables pinch-zoom, which
  // fails Lighthouse's meta-viewport accessibility audit and genuinely
  // blocks low-vision users regardless of what Lighthouse thinks.
  themeColor: "#ff3f6c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="antialiased">
        <StoreHydration />
        <PhoneFrame>
          <ToastProvider>{children}</ToastProvider>
        </PhoneFrame>
      </body>
    </html>
  );
}
