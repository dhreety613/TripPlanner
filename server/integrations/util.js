import crypto from 'node:crypto';
import { z } from 'zod';

// Deterministic pseudo-random in [0,1) from a string, so mock data is stable per query.
export function seeded(str) {
  let h = crypto.createHash('sha256').update(String(str)).digest().readUInt32BE(0);
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    return h / 2 ** 32;
  };
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const place = z.string().trim().min(2).max(80);

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Every integration answer carries the same envelope so the client can tell real from mock.
export const envelope = (provider, data) => ({ provider, ...data });
