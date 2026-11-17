import crypto from 'node:crypto';
import { z } from 'zod';
import { envelope } from './util.js';

// PROPOSED / MOCK: a two-step intent/confirm flow shaped like Stripe PaymentIntents / Razorpay Orders.
// Real Google Pay flow: the browser calls the Google Pay API (PaymentsClient.loadPaymentData) to get an
// encrypted token; the server forwards it to a PSP (Razorpay / Stripe / PayU) and confirms. For UPI the PSP
// returns a UPI intent/collect request. This server must NEVER see raw card numbers: `.strict()` rejects
// any unknown field, so a card number in the body is refused rather than stored.
export const IntentBody = z
  .object({
    amountInr: z.number().positive().max(500000),
    method: z.enum(['gpay', 'upi', 'card']).default('gpay'),
    description: z.string().trim().max(120).default('Trip booking'),
    refs: z.array(z.string().max(40)).max(10).default([]),
  })
  .strict();

export const ConfirmBody = z.object({ intentId: z.string().regex(/^pi_[a-f0-9]{12}$/) }).strict();

const intents = new Map(); // in-memory; a real system persists these in a database
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [k, v] of intents) if (v.createdAt < cutoff) intents.delete(k);
}, 600_000).unref();

const pub = ({ createdAt, ...rest }) => rest;

export function createIntent(body) {
  const intentId = `pi_${crypto.randomBytes(6).toString('hex')}`;
  const intent = { intentId, ...body, currency: 'INR', status: 'requires_confirmation', createdAt: Date.now() };
  if (intents.size >= 1000) intents.delete(intents.keys().next().value);
  intents.set(intentId, intent);
  return envelope('mock', {
    mock: true,
    proposedProvider: 'Google Pay API + Razorpay / Stripe',
    intent: pub(intent),
    clientHint: body.method === 'gpay' ? 'Client would call PaymentsClient.loadPaymentData() and POST the token to the PSP-backed confirm step' : undefined,
  });
}

export function confirmIntent({ intentId }) {
  const i = intents.get(intentId);
  if (!i) return null;
  i.status = 'succeeded';
  return envelope('mock', { mock: true, intent: pub(i), note: 'Simulated. No money moved.' });
}
