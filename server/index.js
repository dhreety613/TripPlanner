import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { PlanRequest, MAX_BLOCKS } from '@trip/shared';
import { config } from './config.js';
import { getProvider } from './providers/index.js';
import { ProviderError } from './providers/http.js';
import { SYSTEM, buildUser } from './prompt.js';
import { createLineParser, parseWhole } from './parser.js';
import { createIntegrationsRouter } from './integrations/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const provider = getProvider();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '128kb' }));

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  });
  next();
});

// --- tiny in-memory per-IP limiter + global concurrency cap (swap for Redis if you scale out)
const hits = new Map();
function allow(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < config.rateLimit.windowMs);
  if (arr.length >= config.rateLimit.max) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) if (!arr.some((t) => now - t < config.rateLimit.windowMs)) hits.delete(ip);
}, 60_000).unref();

let active = 0;
const fail = (res, status, code, message, retryable = false) =>
  res.status(status).json({ error: { code, message, retryable } });

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, provider: provider.name, model: provider.model, mock: provider.name === 'mock' }),
);

app.post('/api/plan', async (req, res) => {
  const parsed = PlanRequest.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'BAD_REQUEST', parsed.error.issues[0].message);
  if (!allow(req.ip)) {
    res.set('Retry-After', '30');
    return fail(res, 429, 'RATE_LIMITED', 'Too many requests. Wait a few seconds.', true);
  }
  if (active >= config.maxConcurrent) return fail(res, 503, 'BUSY', 'Server is busy. Try again.', true);

  const { prompt, current } = parsed.data;
  const id = crypto.randomUUID().slice(0, 8);
  const t0 = Date.now();
  let blocks = 0;
  let dropped = 0;
  let stops = 0;
  let outcome = 'ok';

  active++;
  const client = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) client.abort(new Error('client_closed'));
  });
  const signal = AbortSignal.any([client.signal, AbortSignal.timeout(config.upstreamTimeoutMs)]);

  res.status(200).set({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = (o) => !res.writableEnded && res.write(JSON.stringify(o) + '\n');
  const emit = (results) => {
    for (const r of results) {
      if (r.ok) {
        if (blocks >= MAX_BLOCKS) continue;
        blocks++;
        if (r.block.type === 'stop') stops++;
        send({ event: 'block', data: r.block });
      } else {
        dropped++;
        if (dropped <= 5) send({ event: 'warn', reason: r.reason });
      }
    }
  };

  send({ event: 'start', id, provider: provider.name, model: provider.model });
  const parser = createLineParser();
  try {
    for await (const chunk of provider.stream({ system: SYSTEM, user: buildUser({ prompt, current }), prompt, current, signal })) {
      emit(parser.push(chunk));
      if (blocks >= MAX_BLOCKS) break;
    }
    emit(parser.flush());
    if (blocks === 0) {
      // Fallback: maybe the model returned one pretty-printed / fenced document.
      // The per-line failures above were just that formatting, so don't report them as dropped.
      dropped = 0;
      emit(parseWhole(parser.raw));
      if (blocks > 0) send({ event: 'warn', reason: 'recovered via whole-document fallback' });
    }
    if (stops === 0) {
      outcome = 'no_itinerary';
      send({
        event: 'error',
        code: 'NO_ITINERARY',
        message: blocks === 0 ? "The model's reply couldn't be understood as an itinerary." : 'The model did not produce any stops. Try describing a destination and duration.',
        retryable: true,
      });
    } else {
      send({ event: 'done', blocks, dropped });
    }
  } catch (err) {
    const timedOut = signal.aborted && !client.signal.aborted;
    if (client.signal.aborted) outcome = 'client_closed';
    else {
      outcome = timedOut ? 'timeout' : err.code || 'error';
      const known = err instanceof ProviderError;
      if (!known && !timedOut) console.error(JSON.stringify({ level: 'error', id, err: String(err?.stack || err) }));
      send({
        event: 'error',
        code: timedOut ? 'UPSTREAM_TIMEOUT' : known ? err.code : 'UPSTREAM_UNREACHABLE',
        message: timedOut ? 'The AI took too long to respond.' : known ? err.message : 'Could not reach the AI provider.',
        retryable: timedOut || !known || err.retryable,
      });
    }
  } finally {
    active--;
    res.end();
    console.log(JSON.stringify({ level: 'info', msg: 'plan', id, provider: provider.name, ms: Date.now() - t0, blocks, dropped, refine: !!current, outcome }));
  }
});

// Integration endpoints (weather live via Open-Meteo; transport/stays/payments are flagged mocks).
app.use('/api/integrations', (req, res, next) => (allow(req.ip) ? next() : fail(res, 429, 'RATE_LIMITED', 'Too many requests. Wait a few seconds.', true)), createIntegrationsRouter());

// Unknown /api routes + malformed JSON bodies get JSON errors, never HTML stack traces.
app.use('/api', (_req, res) => fail(res, 404, 'NOT_FOUND', 'Unknown endpoint'));
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return fail(res, 400, 'BAD_JSON', 'Request body is not valid JSON');
  if (err?.type === 'entity.too.large') return fail(res, 413, 'TOO_LARGE', 'Request too large');
  console.error(err);
  fail(res, 500, 'INTERNAL', 'Internal error');
});

const dist = path.resolve(__dirname, '../client/dist');
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'), (e) => e && res.status(404).send('Client not built. Run npm run build.')));

const server = app.listen(config.port, () =>
  console.log(JSON.stringify({ level: 'info', msg: 'listening', port: config.port, provider: provider.name, model: provider.model })),
);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
