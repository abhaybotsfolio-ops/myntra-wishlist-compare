---
name: ship-to-vercel
description: Getting the MVP deployed to a live Vercel URL — build config, env vars, the single human authentication step, and post-deploy verification. Load at Phase 9, before touching next.config or running any vercel command.
---

# ship-to-vercel

The deliverable is a URL a reviewer can open on their phone with no explanation. A perfect
local build is worth nothing here.

## Pre-flight

Before any deploy command:

```bash
npx tsc --noEmit
npm run lint
npm run validate:data
npm run build
npx playwright test
grep -ri "myntassets\|myntra\.com" --include="*.ts*" --include="*.json" src/ data/ && echo "RULE A1/A2 VIOLATION" && exit 1
```

Remove `/kitchen-sink`, the `g` alignment overlay, and any other dev affordance from the
production build. Guard them with `process.env.NODE_ENV === 'development'` rather than
deleting the code, so they remain available for later work.

## Build config

`next.config.ts` — no `remotePatterns` needed, since all imagery is local. If a placeholder
service crept in during development, that is a bug to fix, not to configure around.

```ts
export default {
  images: { formats: ['image/avif', 'image/webp'] },
  experimental: { optimizePackageImports: ['lucide-react'] },
};
```

Route handlers that read seed JSON should be `export const dynamic = 'force-dynamic'` for
`/api/inventory` — it must not be statically cached, or the live stock update silently stops
working in production while continuing to work locally. That failure mode is easy to miss
because every local test passes.

`/api/summarize` is a POST and is dynamic by default. Set `export const maxDuration = 15`.

## Environment

```
# .env.example  (committed)
GEMINI_API_KEY=
```

`.env.local` is gitignored. The app must build and run with neither set — RULES D3 — falling
back to `summaries.fallback.json`. Verify that explicitly by building once with the key
removed before you deploy.

## The single human step

You cannot authenticate to Vercel on the operator's behalf and you must not create an account
for them. Sequence it to interrupt exactly once:

1. Push to GitHub first (`gh repo create` if the CLI is authenticated; otherwise instruct).
2. Run `npx vercel login`, then stop and print one short block:

   > **Two things I need from you, then I'll finish:**
   > 1. A browser window is open for Vercel login — complete it and come back.
   > 2. Paste a free Gemini API key from https://aistudio.google.com/apikey when I ask.
   >    (Optional — without it the app runs on precomputed summaries.)

3. On confirmation: `npx vercel link`, `npx vercel --prod`.
4. `npx vercel env add GEMINI_API_KEY production`, then redeploy so the value is picked up.
   A common mistake is setting the variable after the final deploy and reporting success
   while production is still running on fallbacks.

Do not batch other questions into this interruption. If a product decision is still open at
Phase 9, you skipped `CLAUDE.md` §6 — decide it, log it in `DECISIONS.md`, move on.

## Post-deploy verification — do this yourself

Against the live URL, not localhost:

- Full flow on a 390×844 viewport: wishlist → Shirts → Compare → select 3 → swipe all three →
  observe the 15s stock change → add one to bag → remove one → confirm the deck is still open
  at 2 items.
- Confirm summaries are LLM-sourced in production, not fallbacks. Check the server logs, or
  compare rendered themes against `summaries.fallback.json` — if they are identical, the env
  var did not take.
- Console clean. No 404s on imagery. No hydration warnings.
- Lighthouse mobile on the live URL: performance ≥85, accessibility ≥95.
- Open it on an actual phone. The frame, the swipe physics and the tap targets all behave
  differently under a thumb than under a mouse, and the swipe deck is the entire feature.

## Reporting done

Give the operator, in this order: the live URL, one line on what to tap to see the size wedge
change mid-session, the GitHub URL, and anything in `DECISIONS.md` that materially affects how
the feature reads against the PRD. Keep it short — the artifact is the deliverable, not the
write-up.
