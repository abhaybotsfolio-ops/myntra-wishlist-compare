import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { ToastProvider } from "@/components/ui/Toast";
import { StoreHydration } from "@/components/ui/StoreHydration";

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
    <html lang="en">
      <body className="antialiased">
        <StoreHydration />
        <PhoneFrame>
          <ToastProvider>{children}</ToastProvider>
        </PhoneFrame>
      </body>
    </html>
  );
}
