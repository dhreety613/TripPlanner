import { z } from 'zod';
import { addDays, envelope, isoDate, place, seeded } from './util.js';

// PROPOSED / MOCK. Production path: Booking.com Demand API / Expedia Rapid / a Goibibo-MMT partner API for
// hotels. Airbnb has no public booking API, so homestays would come via an aggregator/channel manager.
export const Query = z.object({
  city: place,
  checkin: isoDate,
  nights: z.coerce.number().int().min(1).max(30).default(2),
  guests: z.coerce.number().int().min(1).max(10).default(2),
  type: z.enum(['hotel', 'homestay', 'hostel', 'any']).default('any'),
  maxPriceInr: z.coerce.number().int().positive().optional(),
});

const NAMES = ['Heritage Haveli', 'Lakeview Residency', 'The Old Town Inn', 'Garden Courtyard', 'Skyline Suites', 'Sunrise Homestay', 'Banyan Retreat', 'City Nest'];
const BASE = { hostel: 600, homestay: 1800, hotel: 3200 };

export function searchStays({ city, checkin, nights, guests, type, maxPriceInr }) {
  const r = seeded(`${city}|${checkin}|${nights}`);
  let list = NAMES.map((name, i) => {
    const t = ['hotel', 'homestay', 'hostel'][Math.floor(r() * 3)];
    return {
      id: `stay-${i + 1}`,
      name: `${name} ${city}`,
      type: t,
      rating: Math.round((3.4 + r() * 1.5) * 10) / 10,
      pricePerNightInr: Math.round((BASE[t] * (0.7 + r() * 1.1)) / 50) * 50,
      freeCancellation: r() > 0.4,
      distanceToCenterKm: Math.round(r() * 80) / 10,
    };
  });
  if (type !== 'any') list = list.filter((s) => s.type === type);
  if (maxPriceInr) list = list.filter((s) => s.pricePerNightInr <= maxPriceInr);
  return envelope('mock', {
    mock: true,
    proposedProvider: 'Booking.com Demand API / Goibibo (MMT partner) / homestay aggregator',
    query: { city, checkin, checkout: addDays(checkin, nights), nights, guests, type },
    results: list.map((s) => ({ ...s, totalInr: s.pricePerNightInr * nights })).sort((a, b) => b.rating - a.rating),
    note: 'Illustrative data only. Not real availability or prices.',
  });
}
