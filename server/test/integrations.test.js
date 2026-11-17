import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createIntegrationsRouter } from '../integrations/index.js';

async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/integrations', createIntegrationsRouter({ offline: true }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/integrations`;
  try { await fn(base); } finally { server.close(); }
}
const post = (u, body) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('registry lists all four capabilities and labels weather live', async () => {
  await withServer(async (b) => {
    const j = await (await fetch(b)).json();
    assert.deepEqual(j.integrations.map((i) => i.id), ['weather', 'transport', 'stays', 'payments']);
    assert.equal(j.integrations[0].status, 'live');
    assert.ok(j.integrations.slice(1).every((i) => i.status === 'proposed'));
  });
});

test('weather: validates input, returns the requested number of days, flags mock when offline', async () => {
  await withServer(async (b) => {
    assert.equal((await fetch(`${b}/weather`)).status, 400);
    assert.equal((await fetch(`${b}/weather?city=Rome&days=99`)).status, 400);
    const j = await (await fetch(`${b}/weather?city=Rome&start=2026-12-01&days=3`)).json();
    assert.equal(j.days.length, 3);
    assert.equal(j.days[0].date, '2026-12-01');
    assert.equal(j.mock, true);
    assert.ok(Array.isArray(j.packingHints) && j.packingHints.length > 0);
  });
});

test('transport + stays: deterministic, filtered, clearly marked mock', async () => {
  await withServer(async (b) => {
    const q = `${b}/transport/search?from=Guwahati&to=Shillong&date=2026-12-02&mode=bus`;
    const a = await (await fetch(q)).json();
    assert.deepEqual(a, await (await fetch(q)).json());
    assert.equal(a.mock, true);
    assert.equal(a.options.length, 4);
    assert.ok(a.options.every((o, i, arr) => i === 0 || arr[i - 1].priceInr <= o.priceInr));
    assert.equal((await fetch(`${b}/transport/search?from=A&to=B&date=nope`)).status, 400);

    const s = await (await fetch(`${b}/stays/search?city=Shillong&checkin=2026-12-02&nights=3&type=homestay&maxPriceInr=4000`)).json();
    assert.equal(s.mock, true);
    assert.equal(s.query.checkout, '2026-12-05');
    assert.ok(s.results.every((r) => r.type === 'homestay' && r.pricePerNightInr <= 4000 && r.totalInr === r.pricePerNightInr * 3));
  });
});

test('payments: intent then confirm; rejects unknown fields (no card data), bad ids, unknown intents', async () => {
  await withServer(async (b) => {
    const r = await post(`${b}/payments/intent`, { amountInr: 2500, method: 'gpay', description: 'Shillong stay' });
    assert.equal(r.status, 201);
    const { intent, mock } = await r.json();
    assert.equal(mock, true);
    assert.equal(intent.status, 'requires_confirmation');
    assert.match(intent.intentId, /^pi_[a-f0-9]{12}$/);

    assert.equal((await post(`${b}/payments/intent`, { amountInr: 100, cardNumber: '4242424242424242' })).status, 400);
    assert.equal((await post(`${b}/payments/intent`, { amountInr: -5 })).status, 400);
    assert.equal((await post(`${b}/payments/confirm`, { intentId: 'nope' })).status, 400);
    assert.equal((await post(`${b}/payments/confirm`, { intentId: 'pi_000000000000' })).status, 404);

    const ok = await post(`${b}/payments/confirm`, { intentId: intent.intentId });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).intent.status, 'succeeded');
  });
});
