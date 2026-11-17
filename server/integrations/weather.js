import { z } from 'zod';
import { addDays, envelope, isoDate, place, seeded } from './util.js';

// LIVE: Open-Meteo (free, no API key). Geocode the city, then fetch a daily forecast.
// Falls back to deterministic mock data if offline or the upstream fails, flagged `mock: true`.
export const Query = z.object({
  city: place,
  start: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(14).default(5),
});

const WMO = (c) =>
  c === 0 ? 'Clear' : c <= 3 ? 'Partly cloudy' : c <= 48 ? 'Fog' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Showers' : 'Thunderstorm';

function packing(days) {
  const rainy = days.some((d) => d.precipMm >= 2);
  const hot = days.some((d) => d.maxC >= 32);
  const cold = days.some((d) => d.minC <= 8);
  return [rainy && 'Light rain jacket / umbrella', hot && 'Sunscreen, hat, water bottle', cold && 'Warm layer', 'Comfortable walking shoes'].filter(Boolean);
}

export async function getWeather({ city, start, days }, { offline = false } = {}) {
  const from = start || new Date().toISOString().slice(0, 10);
  if (!offline) {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(6000) });
      if (!geoRes.ok) throw new Error(`geocoding HTTP ${geoRes.status}`);
      const geo = await geoRes.json();
      const g = geo.results?.[0];
      if (g) {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}` +
          `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${from}&end_date=${addDays(from, days - 1)}`;
        const fRes = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!fRes.ok) throw new Error(`forecast HTTP ${fRes.status}`);
        const f = await fRes.json();
        if (f.daily?.time?.length) {
          const out = f.daily.time.map((date, i) => ({
            date,
            summary: WMO(f.daily.weathercode[i]),
            maxC: Math.round(f.daily.temperature_2m_max[i]),
            minC: Math.round(f.daily.temperature_2m_min[i]),
            precipMm: Math.round((f.daily.precipitation_sum[i] ?? 0) * 10) / 10,
          }));
          return envelope('open-meteo', { mock: false, city: g.name, country: g.country, days: out, packingHints: packing(out) });
        }
      }
    } catch (e) {
      // Log only a short reason (never URLs with user data beyond the city, never keys), then fall back to mock.
      console.warn(JSON.stringify({ level: 'warn', msg: 'weather upstream failed, using mock', reason: String(e?.message || e).slice(0, 120) }));
    }
  }
  const r = seeded(`${city}|${from}`);
  const out = Array.from({ length: days }, (_, i) => {
    const maxC = Math.round(18 + r() * 16);
    return {
      date: addDays(from, i),
      summary: ['Clear', 'Partly cloudy', 'Showers'][Math.floor(r() * 3)],
      maxC,
      minC: maxC - Math.round(6 + r() * 5),
      precipMm: Math.round(r() * 60) / 10,
    };
  });
  return envelope('mock', { mock: true, city, days: out, packingHints: packing(out) });
}
