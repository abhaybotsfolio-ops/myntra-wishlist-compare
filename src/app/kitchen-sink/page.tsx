"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Button, Reason } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/lib/toast-bus";

const TOKENS = [
  "brand",
  "brand-dark",
  "brand-tint",
  "ink",
  "ink-muted",
  "ink-faint",
  "line",
  "surface",
  "canvas",
  "discount",
  "positive",
  "warning",
  "negative",
] as const;

export default function KitchenSinkPage() {
  // Dev-only. Guarded rather than deleted so it stays available for later
  // work (ship-to-vercel skill) — 404s once NODE_ENV is production.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8 p-4 pb-24">
      <header>
        <h1 className="text-[20px] font-bold text-ink">Kitchen sink</h1>
        <p className="text-[13px] text-ink-muted">
          Every primitive, every state. Dev-only — 404s in production.
        </p>
      </header>

      <Section title="Color tokens">
        <div className="grid grid-cols-4 gap-3">
          {TOKENS.map((t) => (
            <div key={t} className="flex flex-col gap-1">
              <div
                className="h-12 rounded-lg border border-line"
                style={{ background: `var(--color-${t})` }}
              />
              <span className="text-[11px] text-ink-faint">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-3">
          <Row label="primary">
            <Button variant="primary">Add to Bag</Button>
          </Row>
          <Row label="secondary">
            <Button variant="secondary">See product</Button>
          </Row>
          <Row label="ghost">
            <Button variant="ghost">Cancel</Button>
          </Row>
          <Row label="subtle">
            <Button variant="subtle">Remove from wishlist</Button>
          </Row>
          <Row label="disabled + reason">
            <div className="flex flex-col items-start gap-1">
              <Button variant="primary" disabled>
                Add to Bag
              </Button>
              <Reason>Unavailable in your size (M)</Reason>
            </div>
          </Row>
          <Row label="full width">
            <Button variant="primary" fullWidth>
              Compare 3
            </Button>
          </Row>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">Selected</Badge>
          <Badge tone="positive">In stock</Badge>
          <Badge tone="warning">Only 2 left</Badge>
          <Badge tone="negative">Unavailable</Badge>
          <Badge tone="neutral">4.1 ★ | 2841</Badge>
          <Badge tone="neutral" dot={false}>
            50% OFF
          </Badge>
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[200px] w-full" />
          <SkeletonText lines={3} />
        </div>
      </Section>

      <Section title="Toast">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              showToast("You can compare up to 4 items at a time")
            }
          >
            Neutral toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast("This item just went out of stock in size M", {
                tone: "warning",
              })
            }
          >
            Warning toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast("Removed — only 1 item left, back to wishlist", {
                tone: "negative",
              })
            }
          >
            Negative toast
          </Button>
        </div>
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open size guide
        </Button>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Size guide — Shirts"
        >
          <p className="text-[13px] text-ink-muted">
            General size guide content goes here (R4 no-signal branch).
          </p>
        </Sheet>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[14px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-[11px] text-ink-faint">
        {label}
      </span>
      {children}
    </div>
  );
}
