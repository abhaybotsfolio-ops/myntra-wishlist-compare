---
name: myntra-ui
description: Visual design system for the Myntra Wishlist Comparison MVP — palette, type scale, spacing, component specs, the phone frame, and the attribute-row alignment mechanic. Load before writing any component, any CSS, or any Tailwind config.
---

# myntra-ui

The demo has to look like it belongs inside the Myntra app. Not a pixel-clone — a credible
sibling. A reviewer decides in the first two seconds whether this is a prototype or a
product, and that judgement colours everything they think about the product reasoning
afterwards.

## Identity

Myntra's visual language is: white surfaces, a hot-pink/magenta primary, dense but airy
product grids, small-caps brand names in bold above lighter product titles, and price
displayed as **discounted price → struck MRP → discount percentage in orange-red**, in that
order, on one line. Get that price line right and everything else reads as authentic.

## Tokens (Tailwind v4 `@theme`)

```css
@theme {
  --color-brand:        #ff3f6c;   /* primary CTA, active states */
  --color-brand-dark:   #e0234e;   /* pressed */
  --color-brand-tint:   #fff0f4;   /* selected backgrounds */
  --color-ink:          #282c3f;   /* primary text — Myntra's near-navy, not black */
  --color-ink-muted:    #535766;   /* secondary text */
  --color-ink-faint:    #94969f;   /* tertiary, struck MRP, metadata */
  --color-line:         #eaeaec;   /* hairlines, dividers, card borders */
  --color-surface:      #ffffff;
  --color-canvas:       #f5f5f6;   /* page background behind cards */
  --color-discount:     #ff905a;   /* discount % */
  --color-positive:     #03a685;   /* in stock, rating pill, positive theme */
  --color-warning:      #f2a03d;   /* low stock */
  --color-negative:     #d43d51;   /* unavailable, negative theme */
}
```

Type: system stack (`-apple-system, "Segoe UI", Roboto, sans-serif`). Scale — `11/13/14/16/20/24px`.
Brand names `14px/700`, tracking tight. Product titles `13px/400` in `--color-ink-muted`,
truncated to one line on tiles, two lines on compare cards. Radii: `4px` tiles, `8px` cards,
`999px` pills. One shadow only: `0 2px 8px rgb(40 44 63 / 0.08)`.

**No gradients on product surfaces. No glassmorphism. No dark mode.** Myntra is a bright,
flat, high-density retail UI, and a "beautiful" reinterpretation reads as a designer's
concept piece rather than a shippable feature.

## Phone frame

One layout. Below 768px, full-bleed. At 768px and above, the same tree renders inside a
390×844 frame: rounded 44px, 10px bezel in `#1c1c1e`, a status bar showing a plausible time
and full battery, and `--color-canvas` behind it. Do not build a desktop-specific layout —
the PRD describes a mobile feature and a stretched desktop version undermines it.

## Component specs

**Product tile (wishlist grid, 2-up):** 3:4 image, brand `14/700`, title `13/400` one line,
price line, and a small heart affordance. In selection mode a 22px circular checkbox appears
top-right; selected tiles get a 2px `--color-brand` ring and `--color-brand-tint` background.

**Price line:** `₹899` at `14/700` ink, `₹1799` struck at `12/400` faint, `50% OFF` at
`12/700` in `--color-discount`. Baseline-aligned, `6px` gaps. Never wrap.

**Rating pill:** `4.1 ★ | 2841` — `12/700`, star in `--color-positive`, count after a hairline
divider in faint. This is the Myntra pattern; use it exactly.

**Sticky compare bar (R2):** fixed bottom, 56px, full-width `--color-brand` button, `16/700`
uppercase-ish label, disabled at 45% opacity with `pointer-events:none` but still
screen-reader announced. Cancel as a text button to its left.

**Compare card (R3):** `--color-surface`, 8px radius, 1px `--color-line`, 12px horizontal
gutters. Fills the deck viewport minus the action bar, which is pinned to the card's bottom
so Add to Bag never requires scrolling (RULES E3).

**Size wedge (R4):** the most important 76px on the screen. Bordered block, tinted by state —
`--color-positive` at 8% for available, `--color-warning` at 10% for low, `--color-negative`
at 8% for unavailable. Line 1: `Your size: M · In stock` at `14/700`. Line 2: the basis
string at `11/400` faint. No-signal variant: `Size guide` with a chevron, at the same height,
never blank.

**Review theme row (R5):** each theme is a stacked pair — label `13/600` ink, detail `12/400`
muted — with a 4px sentiment dot before the label. Under the group, `from 34 reviews` at
`11/400` faint. Themes read as findings, not blurbs.

## Attribute row alignment — the mechanic

This is the one thing that must not be approximated.

```tsx
{ATTRIBUTE_ROWS.map(({ key, minH }) => (
  <div key={key} data-row={key} style={{ minHeight: minH }}
       className="flex flex-col justify-center px-3 border-b border-line last:border-0">
    {renderRow(key, product)}
  </div>
))}
```

Every card maps the same array. Fixed `minHeight` per row. Never `flex-1`, never `auto` on a
row that could contain variable-length content, never a conditionally rendered row — a hidden
row shifts everything below it on that card only, which breaks R3 silently and is very hard
to spot by eye.

Ship a dev-only overlay behind a `g` keypress that absolutely-positions a 1px
`--color-brand`/30 line at each cumulative row boundary across the whole deck. Alignment bugs
become obvious instead of subtle.

## Motion

Framer Motion, restrained. Swipe: `drag="x"` with `dragElastic: 0.12`, snap on velocity >500
or displacement >30% of card width, spring `{ stiffness: 320, damping: 34 }`. Toasts: 180ms
fade + 8px rise. Wedge state change: 240ms colour crossfade — visible enough that a reviewer
notices the live stock update, not so animated that it looks like a bug. Respect
`prefers-reduced-motion` by dropping to opacity-only transitions.

## Empty and edge states

Every one of these must be designed, not defaulted: an empty category, a category with one
item (Compare disabled with a reason), a below-threshold review section, a no-signal size
wedge, an unavailable item's disabled Add to Bag, and the return-to-wishlist toast after
removing down to one item. These states are where a reviewer looks to tell a prototype from a
product.
