// Incremental, forgiving parser for model output.
//
// Strategy (defence in depth, because LLMs are not JSON serialisers):
//   1. Line parser: emits each valid block the moment its line completes (enables streaming).
//   2. Salvage: a line with junk around a {...} still gets one repair attempt.
//   3. Whole-text fallback: if line parsing yielded nothing, scan the full text for balanced
//      top-level JSON objects (handles pretty-printed / fenced / single-document output)
//      and normalise {title, days:[{stops}]} shaped documents into blocks.
import { parseBlock } from '@trip/shared';

const RAW_CAP = 200_000;

function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function parseLine(line) {
  let s = line.trim();
  if (!s || s.startsWith('```')) return null;
  s = s.replace(/^,/, '').replace(/,$/, '');
  let obj = tryParse(s);
  if (obj === undefined) {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) obj = tryParse(s.slice(a, b + 1));
  }
  if (obj === undefined || obj === null || typeof obj !== 'object') {
    return { ok: false, reason: 'invalid_json', raw: s.slice(0, 160) };
  }
  const r = parseBlock(obj);
  return r.ok ? r : { ok: false, reason: r.reason, raw: s.slice(0, 160) };
}

export function createLineParser() {
  let buf = '';
  let raw = '';
  return {
    push(chunk) {
      if (raw.length < RAW_CAP) raw += chunk;
      buf += chunk;
      const out = [];
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const r = parseLine(buf.slice(0, i));
        buf = buf.slice(i + 1);
        if (r) out.push(r);
      }
      return out;
    },
    flush() {
      const r = buf.trim() ? parseLine(buf) : null;
      buf = '';
      return r ? [r] : [];
    },
    get raw() {
      return raw;
    },
  };
}

/** Yield substrings of every balanced top-level {...} in text (string/escape aware). */
export function extractObjects(text) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

/** Convert a "whole document" plan into blocks. */
export function normalizeWhole(doc) {
  const blocks = [];
  const days = doc.days || doc.itinerary || doc.plan;
  if (!Array.isArray(days)) return blocks;
  blocks.push({ type: 'trip', title: doc.title || doc.name || 'Trip', summary: doc.summary || doc.description });
  days.forEach((d, i) => {
    const n = d.day ?? d.dayNumber ?? i + 1;
    blocks.push({ type: 'day', day: n, title: d.title || d.theme || `Day ${n}` });
    const stops = d.stops || d.activities || d.items || [];
    if (Array.isArray(stops)) {
      for (const s of stops) {
        blocks.push({
          type: 'stop',
          day: n,
          name: s.name || s.title || s.activity,
          time: s.time,
          category: s.category,
          durationMin: s.durationMin ?? s.duration,
          description: s.description,
          cost: s.cost,
          tip: s.tip,
        });
      }
    }
  });
  for (const c of doc.checklists || []) blocks.push({ type: 'checklist', ...c });
  if (doc.chart) blocks.push({ type: 'chart', ...doc.chart });
  return blocks;
}

/** Whole-text fallback. Returns parse results in the same shape as the line parser. */
export function parseWhole(text) {
  const results = [];
  for (const s of extractObjects(text)) {
    const obj = tryParse(s);
    if (!obj || typeof obj !== 'object') continue;
    const candidates = obj.type ? [obj] : normalizeWhole(obj);
    for (const c of candidates) {
      const r = parseBlock(c);
      results.push(r.ok ? r : { ok: false, reason: r.reason, raw: s.slice(0, 160) });
    }
  }
  return results;
}
