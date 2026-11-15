import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineParser, parseWhole, extractObjects } from '../parser.js';

const stop = { type: 'stop', day: 1, name: 'Louvre', category: 'sight', cost: 20 };

test('parses lines split across chunks', () => {
  const p = createLineParser();
  const s = JSON.stringify(stop);
  const a = p.push(s.slice(0, 10));
  const b = p.push(s.slice(10) + '\n');
  assert.equal(a.length, 0);
  assert.equal(b.length, 1);
  assert.equal(b[0].ok, true);
});

test('skips fences, drops malformed, keeps valid', () => {
  const p = createLineParser();
  const out = [...p.push('```json\n{"type":"stop","day":1,"name":"A"}\nnot json\n{"type":"stop","day":"x","name":""}\n```\n'), ...p.flush()];
  assert.deepEqual(out.map((r) => r.ok), [true, false, false]);
});

test('coerces bad optional fields instead of rejecting the stop', () => {
  const p = createLineParser();
  const [r] = p.push('{"type":"stop","day":"2","name":"B","category":"nonsense","cost":"abc","durationMin":"45"}\n');
  assert.equal(r.ok, true);
  assert.equal(r.block.day, 2);
  assert.equal(r.block.category, 'other');
  assert.equal(r.block.cost, undefined);
  assert.equal(r.block.durationMin, 45);
});

test('flush parses trailing line without newline; truncated line is dropped', () => {
  const p = createLineParser();
  p.push('{"type":"tip","text":"hi"}');
  assert.equal(p.flush()[0].ok, true);
  const q = createLineParser();
  q.push('{"type":"tip","te');
  assert.equal(q.flush()[0].ok, false);
});

test('extractObjects ignores braces inside strings', () => {
  assert.equal(extractObjects('x {"a":"}{"} y {"b":1}').length, 2);
});

test('whole-document fallback handles pretty, fenced, differently-named keys', () => {
  const doc = '```json\n' + JSON.stringify({ title: 'T', days: [{ day: 1, title: 'D', activities: [{ title: 'Museum', cost: 5 }] }] }, null, 2) + '\n```';
  const r = parseWhole(doc);
  assert.ok(r.every((x) => x.ok));
  assert.equal(r.filter((x) => x.block.type === 'stop').length, 1);
});

test('pure garbage yields nothing', () => {
  assert.equal(parseWhole('Sure! Here are some thoughts.').length, 0);
});
