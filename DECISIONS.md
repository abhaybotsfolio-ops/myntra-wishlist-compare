# DECISIONS.md

Judgement calls made during the build where the spec bundle was silent, or where the operator
gave an explicit instruction that overrides the spec bundle. Newest at the bottom, in build order.

---

## D0 — LLM provider: Gemini instead of Groq (operator-directed)

**Spec said:** `CLAUDE.md` §3 pins Groq (`llama-3.3-70b-versatile`) and calls the stack table
"decided — do not substitute." The `review-summarizer` and `ship-to-vercel` skills, and every
mention of the summarization env var across `RULES.md`, `docs/ARCHITECTURE.md`,
`docs/BUILD_PLAN.md`, and `docs/ACCEPTANCE.md`, were written around Groq specifically.

**What changed:** The operator explicitly asked for Google Gemini instead, and chose
`gemini-2.0-flash` when offered a choice between that and `gemini-2.5-flash`. This is not a
PRD-silence judgement call — it's a direct operator instruction, which RULES.md itself says
takes precedence.

**How it was applied:**
- Every copy of the spec bundle in this repo (`CLAUDE.md`, `RULES.md`, `docs/`,
  `.claude/skills/`) was edited in place so the committed docs describe what was actually
  built, not what the original template said. `GROQ_API_KEY` → `GEMINI_API_KEY` throughout;
  `console.groq.com/keys` → `aistudio.google.com/apikey`.
- `/api/summarize` calls the Gemini REST endpoint
  (`generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`) with
  plain `fetch` — no `@google/generative-ai` SDK dependency, keeping Phase 0's "nothing else"
  dependency list intact (RULES F5, D4). Gemini's `generationConfig.responseMimeType:
  'application/json'` is the equivalent of Groq/OpenAI's `response_format: {type:
  'json_object'}`; the outbound JSON is still re-validated with Zod regardless.
- Everything else about R5 — threshold gate, anti-sycophancy post-validation, retry-once,
  fallback-first build order, caching, timeouts — is unchanged from the spec's design intent.
  Only the provider and env var name moved.

## Format for entries below

Each entry: what the spec left open, the decision, and why it's the more-honest-to-the-user
reading per `CLAUDE.md` §6.
