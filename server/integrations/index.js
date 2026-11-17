import express from 'express';
import * as weather from './weather.js';
import * as transport from './transport.js';
import * as stays from './stays.js';
import * as payments from './payments.js';

// /api/integrations/*: the "future plug-in" surface. Each capability is either live (weather via
// Open-Meteo) or a clearly-flagged mock (`mock: true`) that documents the real provider to wire in later.
const err = (res, status, code, message) => res.status(status).json({ error: { code, message, retryable: false } });

export const REGISTRY = [
  { id: 'weather', status: 'live', provider: 'Open-Meteo (free, no key)', endpoints: ['GET /api/integrations/weather?city=&start=&days='] },
  { id: 'transport', status: 'proposed', provider: 'IRCTC partner API · MakeMyTrip B2B / Amadeus · redBus', endpoints: ['GET /api/integrations/transport/search?from=&to=&date=&mode=train|flight|bus&passengers='] },
  { id: 'stays', status: 'proposed', provider: 'Booking.com Demand API · Goibibo (MMT) · homestay aggregator', endpoints: ['GET /api/integrations/stays/search?city=&checkin=&nights=&guests=&type='] },
  { id: 'payments', status: 'proposed', provider: 'Google Pay API + Razorpay / Stripe (UPI, cards)', endpoints: ['POST /api/integrations/payments/intent', 'POST /api/integrations/payments/confirm'] },
];

export function createIntegrationsRouter({ offline = process.env.INTEGRATIONS_OFFLINE === '1' } = {}) {
  const r = express.Router();

  r.get('/', (_req, res) => res.json({ integrations: REGISTRY }));

  const get = (path, schema, handler) =>
    r.get(path, async (req, res) => {
      const p = schema.safeParse(req.query);
      if (!p.success) return err(res, 400, 'BAD_REQUEST', p.error.issues[0].message);
      res.json(await handler(p.data));
    });
  get('/weather', weather.Query, (q) => weather.getWeather(q, { offline }));
  get('/transport/search', transport.Query, (q) => transport.searchTransport(q));
  get('/stays/search', stays.Query, (q) => stays.searchStays(q));

  r.post('/payments/intent', (req, res) => {
    const p = payments.IntentBody.safeParse(req.body);
    if (!p.success) return err(res, 400, 'BAD_REQUEST', p.error.issues[0].message);
    res.status(201).json(payments.createIntent(p.data));
  });
  r.post('/payments/confirm', (req, res) => {
    const p = payments.ConfirmBody.safeParse(req.body);
    if (!p.success) return err(res, 400, 'BAD_REQUEST', p.error.issues[0].message);
    const out = payments.confirmIntent(p.data);
    return out ? res.json(out) : err(res, 404, 'NOT_FOUND', 'Unknown payment intent');
  });
  return r;
}
