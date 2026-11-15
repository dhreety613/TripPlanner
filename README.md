# 🍓 Wayfarer — AI trip planner

Describe a trip in plain English. The model streams back **structured blocks** (trip, days, stops, checklists, budget chart, tips) which the app validates and renders as interactive cards you can expand, edit, drag, remove, undo and refine. It is **not** a chatbot: the UI never prints model text.

**Live demo:** https://tripplanner-q2k7.onrender.com
> ⏳ Hosted on Render's free tier: the service **spins down after ~15 min idle**, so the first request can take 30–60 s to wake. The live demo uses Google Gemini via its OpenAI-compatible API (key held server-side only). With no key configured it falls back to a built-in **mock model** (badge in the header).

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env     # optional: add a key. With no key you get the mock model
npm run dev              # API on :8787, web on http://localhost:5173
npm test                 # parser + reducer unit tests
```

Production / Docker (what the live demo runs):

```bash
docker compose up --build         # http://localhost:8787
# or
docker build -t wayfarer . && docker run -p 8787:8787 --env-file .env wayfarer
```

Real model: set `ANTHROPIC_API_KEY`, **or** `LLM_PROVIDER=openai` + `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` for any OpenAI-compatible API (Groq, Gemini, OpenRouter, OpenAI, Ollama). See `.env.example`. The key lives only on the server; the browser never sees it.

Deploying to Render: see [Deploy](#deploy-render-free) below.

## How it works

```
browser ──POST /api/plan──▶ Express ──stream──▶ LLM (Anthropic | OpenAI-compat | mock)
   ▲                           │ NDJSON lines → forgiving parser → zod validation
   └── NDJSON events ◀─────────┘   {event: start | block | warn | done | error}
```

- **Protocol.** The model emits one JSON block per line (NDJSON) rather than one giant document. Each block is validated the moment its line completes and forwarded immediately, so the UI **streams** and a single bad line costs one block, not the whole response. Schema lives in `shared/` and is used by both server and client (the client re-validates everything it receives).
- **Block types.** `trip`, `day`, `stop` (cards), `checklist` (stateful), `chart` (budget bars), `tip`. Each has its own renderer.
- **Refinement loop.** Follow-ups send the *current plan* (including your manual edits) back as blocks; the model returns the updated plan. Every AI step and manual edit is undoable (Ctrl+Z / Ctrl+Shift+Z).
- **Reorder.** Drag the ⋮⋮ handle, or use ↑/↓ buttons (touch), or **Alt+↑/↓** on a focused card (cross-day moves supported). Enter expands, Delete removes.
- **Sessions.** Autosaved to `localStorage` (validated on load), listed in the 📒 panel. Dark mode toggle, reduced-motion respected.

## Failure handling (the important part)

| Failure | Where handled | Behaviour |
|---|---|---|
| Malformed line / wrong shape | server parser + zod | line dropped, stream continues, "N skipped" shown |
| Bad optional field (`cost:"abc"`, unknown category) | schema `.catch` | field defaulted, stop kept |
| Pretty-printed / fenced / differently-keyed JSON | whole-document fallback | recovered via balanced-brace scan + normaliser |
| Prose, empty reply, zero stops | server | `NO_ITINERARY` error + Retry |
| Upstream 4xx/5xx/429/timeout/unreachable | providers + server | mapped to safe error codes (no upstream bodies/keys leaked), `retryable` flag |
| Stream dies mid-response | client | partial plan **kept**, error + Retry shown |
| Network drop / server stalls >30 s | client watchdog | `STALLED`/`TRUNCATED`/`NETWORK` error |
| Retryable error before any output | client | one silent auto-retry |
| Stale response | `usePlanner` | request id + `AbortController`; only the newest request can touch state; Esc cancels |
| Failed with nothing received | reducer | previous plan restored |
| Oversize / invalid request, rate limit, overload | server | 400/413/429/503 JSON errors; per-IP limit + concurrency cap |
| Client disconnects | server | upstream call aborted (no wasted tokens) |

**Try them live** by putting a tag in the prompt (mock model only): `[fail]` `[slow]` `[garbage]` `[empty]` `[partial]` `[pretty]`, e.g. `3 days in Rome [partial]`.

## AI-usage note

AI (Claude) wrote the basic code. The **workflow was designed by me**: the product flow, the NDJSON block protocol, the failure-handling plan, the refinement loop, and the structure of the app. I then used AI to put the pieces in place, and to debug, review, test, and fix breakages. Final deployment was also done with AI assistance. At runtime the app calls an LLM only through `server/providers/*`, server-side.

## Known limitations

- Rate limiter and sessions are in-memory / `localStorage`: fine for one instance; use Redis + a DB to scale or sync across devices.
- Times and costs come from the model and are **estimates**, not bookings; no maps/geocoding or live prices.
- Reordering doesn't recompute times; a refine pass can.
- Refinement re-emits the full plan (simple and robust) rather than patch ops, so it costs more tokens on big plans.
- Native HTML5 drag-and-drop doesn't work on touch screens; buttons and the "Move to" menu cover mobile.
- Free Render tier cold-starts and has no persistent disk.

## Time spent

About **54 hours** in total:

| Activity | Time |
|---|---|
| Designing the workflow | ~36 h |
| Basic code (AI-assisted) | ~10 h |
| Putting things in place with AI: debugging, review, testing, fixing breaks | ~6 h |
| Approach finalisation and deployment (with AI) | ~2 h |

## Deploy (Render, free)

1. Push this folder to a GitHub repo.
2. Render dashboard → **New → Blueprint** → select the repo (uses `render.yaml`, Docker runtime, free plan, health check `/healthz`).
3. *(Optional)* In the service's **Environment** tab add `ANTHROPIC_API_KEY` (or the `LLM_*` vars) for a real model; leave empty for the mock demo.
4. Copy the `https://….onrender.com` URL into the **Live demo** line at the top of this README.

## Layout

```
shared/   zod block schema (single source of truth)
server/   Express API, providers (anthropic | openai-compat | mock), parser, tests
client/   React + Vite UI: reducer w/ undo history, usePlanner hook, components, tests
Dockerfile · docker-compose.yml · render.yaml · CLAUDE.md
```
