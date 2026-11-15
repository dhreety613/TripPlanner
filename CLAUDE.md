# CLAUDE.md: context for Claude Code

## What this is
Wayfarer: AI trip planner for a **Frontend Internship assignment**. Finished and tested; your job is to (1) run it, (2) deploy it to a **live link on Render free tier**, (3) make any requested tweaks. Read `README.md` for architecture and the failure-handling table.

### Assignment requirements (all met; don't regress)
React hooks + functional components · free-form text input · real LLM API called **server-side only** (never ship the key to the browser) · model returns **structured data** parsed into interactive stateful UI (NOT a chatbot, never print raw model text) · expand / remove / reorder stops · handles malformed JSON, wrong shape, empty, slow, failed · no crashes · no stale response overwriting a newer one · loading / error / empty states · mobile · README with setup, AI-usage note, known limitations, time spent.
Stretch (all done): multiple block types (card/checklist/chart/tip), streaming, refinement loop, session save/reload, animation, dark mode, keyboard navigation.

## Commands
```
npm install
npm run dev        # api :8787 + vite :5173 (proxy /api)
npm test           # 13 unit tests (server parser, client reducer)
npm run build      # client/dist, served by Express in prod
npm start          # production server on $PORT (default 8787)
docker compose up --build
```
Node ≥ 20. No `.env` needed: with no key the server uses the **mock provider**.

## Map
- `shared/index.js`: zod block schema (`trip|day|stop|checklist|chart|tip`). Change protocol here first.
- `server/index.js`: `POST /api/plan` streams NDJSON events `start|block|warn|done|error`; rate limit, concurrency cap, abort on client close, timeouts.
- `server/parser.js`: line parser → salvage → whole-document fallback. `server/prompt.js`: system prompt.
- `server/providers/`: `anthropic.js`, `openai.js` (any OpenAI-compatible), `mock.js` (failure tags `[fail] [slow] [garbage] [empty] [partial] [pretty]`).
- `client/src/lib/planReducer.js`: pure plan state + undo/redo (tested). `api.js`: NDJSON stream client with stall watchdog. `hooks/usePlanner.js`: request lifecycle (reqId + AbortController = no stale overwrites).
- `client/src/components/`: `ItineraryView` (days/stops, DnD, keyboard), `Extras` (checklist/chart/tip), `Panels` (prompt, refine, status, error, skeleton, empty, sessions), `Decor` (SVG strawberry/blossom).
- `client/src/styles.css`: watercolor-strawberry theme (sage green, blush pink, cream, leaf green). Colors are CSS variables at the top; keep the aesthetic when editing UI.

## Conventions
- Never log or return upstream response bodies/keys to clients (see `providers/http.js`).
- Any new block type: add to `shared/`, `reducer.applyBlock` + `toBlocks`, a renderer, the prompt, the mock, and a test.
- Keep failure handling intact; add a mock tag + test when adding a failure path.
- Definition of done for any change: `npm test` green, `npm run build` ok, manual check with `[partial]` and `[fail]` tags.

---

## DEPLOY TASK: live link on Render (free)

Goal: a public `https://….onrender.com` URL, then put it in README's **Live demo** line. The README already warns that the free tier **spins down after ~15 min idle** (30–60 s cold start). Keep that warning next to the link.

1. **Verify locally first:** `npm install && npm test && npm run build`. If Docker is available: `docker compose up --build`, then `curl localhost:8787/healthz` and `curl localhost:8787/api/health`.
2. **Git:** `git init && git add -A && git commit -m "Wayfarer trip planner"`. Create a GitHub repo (use `gh repo create wayfarer-trip-planner --public --source=. --push` if `gh` is authenticated; otherwise ask the user to create an empty repo and give you the URL, then `git remote add origin … && git push -u origin main`). Confirm `.env` is not committed.
3. **Render:** deploying needs the user's Render account, so you can't do it silently:
   - Easiest: tell the user to open Render → **New → Blueprint** → select the repo. `render.yaml` configures the Docker web service on the **free** plan with health check `/healthz`.
   - If a Render API key / CLI / MCP is available, create the web service from the same repo yourself (runtime `docker`, plan `free`, `dockerfilePath ./Dockerfile`, health check `/healthz`, autoDeploy on).
   - Optional real model: set `ANTHROPIC_API_KEY` (or `LLM_PROVIDER=openai` + `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) in Render's Environment tab. **Never commit keys.** Leave unset for mock-model demo (the header shows a "demo model" badge). Free Groq/Gemini keys work via the OpenAI-compatible vars; see `.env.example`.
4. **Verify the live URL** (allow ~3–6 min for first build + a cold start): `curl -s https://<url>/api/health`; then POST a trip to `/api/plan` and confirm `done` event; load the page on a phone-width viewport.
5. **Update README:** replace `<PASTE RENDER URL HERE>`, keep the spin-down note; fill the "Time spent" and tailor the "AI-usage note" truthfully (ask the user). Commit + push (autoDeploy redeploys).
6. **Optional keep-warm:** free services sleep; a free uptime pinger hitting `/healthz` every ~10 min avoids cold starts. Mention it but don't set it up unasked.

### Alternatives if not Render (all free tier)
- **Fly.io:** `fly launch --no-deploy` (detects Dockerfile, internal port 8787) → `fly deploy`. Machines auto-stop when idle.
- **Koyeb / Railway / Google Cloud Run:** deploy the Dockerfile; listen on `$PORT` (already honoured).
