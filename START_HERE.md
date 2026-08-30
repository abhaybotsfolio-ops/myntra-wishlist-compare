# START_HERE

This bundle is the complete brief for Claude Code. You should need to intervene twice: once
to paste the kickoff prompt, once to authenticate Vercel.

## Setup (2 minutes)

```bash
mkdir myntra-wishlist-compare && cd myntra-wishlist-compare
# copy the contents of this bundle into that folder, so you have:
#   CLAUDE.md  RULES.md  START_HERE.md  docs/  .claude/skills/
claude
```

Optionally get a free Gemini key first from https://aistudio.google.com/apikey — you'll be asked for
it at the end. The app works without one; summaries fall back to precomputed text.

## The kickoff prompt

Paste this verbatim:

> Read CLAUDE.md, then RULES.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md,
> docs/BUILD_PLAN.md and docs/ACCEPTANCE.md before writing any code. Then build the MVP
> autonomously, working the phases in BUILD_PLAN.md in order, loading the relevant skill from
> .claude/skills/ before each phase and committing at every phase gate. Do not ask me product
> questions — where the PRD is silent, decide, and log it in DECISIONS.md. Interrupt me only
> for the Vercel login and the Gemini key, as described in CLAUDE.md §8. Verify every row of
> ACCEPTANCE.md before you tell me you're done.

Then leave it alone. Expect several hours of autonomous work with one interruption near the end.

## What's in the bundle

| File | Role |
|---|---|
| `CLAUDE.md` | The brief. Scope, stack, hard rules, working method, definition of done |
| `RULES.md` | Non-negotiable constraints — legal, product, honesty, reliability, engineering |
| `docs/PRD.md` | Your PRD, restructured as the authoritative product spec |
| `docs/ARCHITECTURE.md` | System design, state model, route map, event taxonomy, repo layout |
| `docs/DATA_MODEL.md` | Zod schemas and the exact data shape the acceptance tests depend on |
| `docs/BUILD_PLAN.md` | Nine phases with exit gates |
| `docs/ACCEPTANCE.md` | Every PRD criterion as a testable check |
| `.claude/skills/myntra-ui/` | Design tokens, component specs, the row-alignment mechanic |
| `.claude/skills/catalog-seed/` | Data generation, image sourcing, legal boundaries |
| `.claude/skills/review-summarizer/` | Gemini prompt, JSON contract, anti-sycophancy validator |
| `.claude/skills/size-wedge/` | R4 — the differentiator, including the live stock change |
| `.claude/skills/ship-to-vercel/` | Deploy, env vars, the one human step, verification |

## If you want to change scope

The scope decisions are concentrated in `CLAUDE.md` §1–§2 and `RULES.md` §B. Edit those before
you start rather than mid-build. In particular, if you later decide you want the PM-facing
analytics dashboard after all, the event taxonomy in `docs/ARCHITECTURE.md` §7 is already
designed to feed it — the data is being captured whether or not anything displays it.

## For your case write-up

Three things in the build are worth pointing at in a presentation:

1. **The size wedge sits between price and reviews**, not at the bottom. That position comes
   from the PRD's information architecture and it is defensible from the survey data — the
   stock signal (84.6%) is second only to comparison intent itself.
2. **The app refuses to guess.** No size recommendation without a brand signal, no review
   summary below eight reviews, no winner badge. Each refusal is a rule in `RULES.md` and a
   row in `ACCEPTANCE.md`.
3. **The event taxonomy maps one-to-one onto the PRD's success metrics**, including the
   decision-efficiency and leakage proxies. It answers "how would you measure this?" before
   it's asked.
