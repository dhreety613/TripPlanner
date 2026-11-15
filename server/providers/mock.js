// Deterministic offline "model". Makes the live demo work with zero API keys AND lets
// reviewers trigger every failure path on purpose by putting a tag in the prompt:
//   [fail] upstream 5xx   [slow] 12s before first token   [garbage] prose, no JSON
//   [empty] nothing       [partial] valid lines, junk, then stream dies mid-way
//   [pretty] pretty-printed single JSON document (exercises the whole-text fallback)
import { ProviderError } from './http.js';

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new Error('aborted'));
      },
      { once: true },
    );
  });

const TEMPLATES = [
  ['Sunrise walk through {d} old town', 'sight', 90, 0, '08:00'],
  ['Local breakfast at a neighbourhood café', 'food', 60, 12, '09:45'],
  ['Guided highlights tour of {d}', 'activity', 150, 35, '11:00'],
  ['Long lunch at a market hall', 'food', 75, 18, '13:30'],
  ['Museum or gallery of {d}', 'sight', 120, 15, '15:15'],
  ['Sunset viewpoint & dinner', 'food', 120, 40, '18:30'],
];

function guess(prompt) {
  const m = prompt.match(/(?:to|in|for|visit(?:ing)?)\s+([A-Z][\p{L}'’-]+(?:\s[A-Z][\p{L}'’-]+)?)/u);
  const d = prompt.match(/(\d{1,2})\s*[- ]?\s*(?:day|night)/i);
  return { dest: m?.[1] ?? 'Your Destination', days: Math.min(Math.max(Number(d?.[1]) || 3, 1), 7) };
}

function freshPlan(prompt) {
  const { dest, days } = guess(prompt);
  const L = [{ type: 'trip', title: `${days} days in ${dest}`, summary: `A relaxed, food-forward ${days}-day itinerary for ${dest}. (Mock model output)`, currency: 'USD' }];
  for (let d = 1; d <= days; d++) {
    L.push({ type: 'day', day: d, title: ['Arrival & old town', 'Culture & markets', 'Hidden corners', 'Day trip', 'Slow day', 'Neighbourhoods', 'Farewell'][d - 1] });
    TEMPLATES.slice(0, 4 + (d % 3)).forEach(([name, category, durationMin, cost, time]) =>
      L.push({ type: 'stop', day: d, name: name.replace('{d}', dest), time, category, durationMin, cost, description: `Day ${d}: a well-reviewed pick near the centre of ${dest}.`, tip: d === 1 ? 'Book ahead on weekends.' : undefined }),
    );
  }
  L.push({ type: 'checklist', title: 'Before you go', items: ['Passport / ID', 'Travel insurance', 'Local SIM or eSIM', 'Book headline attractions'] });
  L.push({ type: 'chart', title: 'Estimated budget', unit: 'USD', data: [{ label: 'Lodging', value: 120 * days }, { label: 'Food', value: 55 * days }, { label: 'Activities', value: 40 * days }, { label: 'Transport', value: 20 * days }] });
  L.push({ type: 'tip', text: 'Walk first, taxi later: most highlights cluster within 2 km.' });
  return L;
}

function refine(current, prompt) {
  const L = current.map((b) => ({ ...b }));
  const p = prompt.toLowerCase();
  if (/cheap|budget|save/.test(p)) L.forEach((b) => b.type === 'stop' && b.cost != null && (b.cost = Math.round(b.cost * 0.6)));
  else if (/add|more|include/.test(p)) {
    const i = L.map((b) => b.type).lastIndexOf('stop');
    const day = L[i]?.day ?? 1;
    L.splice(i + 1, 0, { type: 'stop', day, name: `Added: ${prompt.slice(0, 60)}`, time: '20:30', category: 'activity', durationMin: 60, cost: 20, description: 'Added by your follow-up request.' });
  } else if (L[0]?.type === 'trip') L[0].summary = `${L[0].summary ?? ''} (Revised: ${prompt.slice(0, 80)})`;
  return L;
}

export function createMock() {
  return {
    name: 'mock',
    model: 'mock-1',
    async *stream({ prompt, current, signal }) {
      const tag = (prompt.match(/\[(fail|slow|garbage|empty|partial|pretty)\]/i) || [])[1]?.toLowerCase();
      if (tag === 'fail') throw new ProviderError('UPSTREAM_ERROR', 'Mock upstream failure (5xx).', { status: 502, retryable: true });
      if (tag === 'slow') await sleep(12_000, signal);
      if (tag === 'empty') return;
      if (tag === 'garbage') {
        yield "Sure! I'd love to help you plan that trip. Here are some thoughts: it sounds amazing, you should definitely go.";
        return;
      }
      const blocks = current?.length ? refine(current, prompt) : freshPlan(prompt);
      if (tag === 'pretty') {
        const days = [];
        for (const b of blocks) {
          if (b.type === 'day') days.push({ day: b.day, title: b.title, activities: [] });
          if (b.type === 'stop') days.find((d) => d.day === b.day)?.activities.push({ title: b.name, time: b.time, category: b.category, cost: b.cost, description: b.description });
        }
        yield '```json\n' + JSON.stringify({ title: blocks[0].title, summary: blocks[0].summary, days }, null, 2) + '\n```';
        return;
      }
      const lines = blocks.map((b) => JSON.stringify(b));
      if (tag === 'partial') {
        const head = lines.slice(0, 7);
        for (const l of head) {
          yield l + '\n';
          await sleep(120, signal);
        }
        yield '{"type":"stop","day":1,"name":"Broken stop","categ\n';
        yield '{"type":"stop","day":"x","name":""}\n';
        yield '{"type":"stop","day":1,"name":"Cut off mid-str';
        throw new ProviderError('UPSTREAM_ERROR', 'Mock stream died mid-response.', { status: 502, retryable: true });
      }
      for (const l of lines) {
        const mid = Math.floor(l.length / 2);
        yield l.slice(0, mid); // split across chunks on purpose: exercises the line buffer
        await sleep(25, signal);
        yield l.slice(mid) + '\n';
        await sleep(110, signal);
      }
    },
  };
}
