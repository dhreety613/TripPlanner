import { z } from 'zod';
import { envelope, isoDate, place, seeded } from './util.js';

// PROPOSED / MOCK. No public booking API exists for IRCTC or MakeMyTrip.
// Production path: IRCTC via an authorised partner/aggregator API, flights via Amadeus Self-Service /
// Skyscanner / a MakeMyTrip B2B agreement, buses via a redBus partner API.
// `searchTransport` is the adapter contract a real provider must satisfy; swap its body for a real call.
export const Query = z.object({
  from: place,
  to: place,
  date: isoDate,
  mode: z.enum(['train', 'flight', 'bus']).default('train'),
  passengers: z.coerce.number().int().min(1).max(6).default(1),
});

const PROPOSED = {
  train: 'IRCTC (via authorised partner API)',
  flight: 'MakeMyTrip B2B / Amadeus',
  bus: 'redBus partner API',
};
const OPERATORS = {
  train: ['Rajdhani Exp', 'Shatabdi Exp', 'Duronto Exp', 'Garib Rath'],
  flight: ['IndiGo', 'Air India', 'Akasa Air', 'Vistara'],
  bus: ['Volvo AC Sleeper', 'Seater Non-AC', 'Semi-Sleeper', 'Multi-axle'],
};

export function searchTransport({ from, to, date, mode, passengers }) {
  const r = seeded(`${mode}|${from}|${to}|${date}`);
  const base = { train: 700, flight: 4200, bus: 900 }[mode];
  const hrs = { train: 8, flight: 2, bus: 10 }[mode];
  const options = OPERATORS[mode].map((operator, i) => {
    const dep = 5 + Math.floor(r() * 16);
    return {
      id: `${mode}-${i + 1}`,
      operator,
      departs: `${String(dep).padStart(2, '0')}:${r() > 0.5 ? '30' : '00'}`,
      durationHours: Math.round(hrs * (0.8 + r() * 0.5) * 10) / 10,
      priceInr: Math.round((base * (0.7 + r() * 0.9)) / 10) * 10 * passengers,
      seatsLeft: Math.floor(r() * 30),
    };
  });
  return envelope('mock', {
    mock: true,
    proposedProvider: PROPOSED[mode],
    query: { from, to, date, mode, passengers },
    options: options.sort((a, b) => a.priceInr - b.priceInr),
    note: 'Illustrative data only. Not real availability or fares.',
  });
}
