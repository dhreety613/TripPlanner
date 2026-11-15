import test from 'node:test';
import assert from 'node:assert/strict';
import { historyReducer, initialHistory, applyBlock, toBlocks, emptyPlan } from '../src/lib/planReducer.js';

const feed = (blocks) => blocks.reduce((s, block) => historyReducer(s, { type: 'stream/block', block }), initialHistory);
const sample = [
  { type: 'trip', title: 'T' },
  { type: 'day', day: 1, title: 'A' },
  { type: 'stop', day: 1, name: 'one', category: 'food' },
  { type: 'stop', day: 1, name: 'two', category: 'food' },
  { type: 'day', day: 2, title: 'B' },
  { type: 'stop', day: 2, name: 'three', category: 'food' },
  { type: 'checklist', title: 'c', items: ['x'] },
];
const names = (s, i) => s.present.days[i].stops.map((x) => x.name);

test('applyBlock builds plan; stop before its day creates the day', () => {
  const p = applyBlock(emptyPlan(), { type: 'stop', day: 3, name: 'x', category: 'other' });
  assert.equal(p.days[0].day, 3);
  assert.equal(p.days[0].stops.length, 1);
});

test('nudge moves within a day and across day boundaries', () => {
  let s = feed(sample);
  const two = s.present.days[0].stops[1].id;
  s = historyReducer(s, { type: 'stop/nudge', stopId: two, dir: -1 });
  assert.deepEqual(names(s, 0), ['two', 'one']);
  s = historyReducer(s, { type: 'stop/nudge', stopId: two, dir: -1 }); // first stop of day 1: nowhere to go
  assert.deepEqual(names(s, 0), ['two', 'one']);
  const one = s.present.days[0].stops[1].id;
  s = historyReducer(s, { type: 'stop/nudge', stopId: one, dir: 1 }); // crosses into day 2, at its start
  assert.deepEqual(names(s, 1), ['one', 'three']);
});

test('move before target, remove, undo/redo', () => {
  let s = feed(sample);
  const [one, two] = s.present.days[0].stops.map((x) => x.id);
  const d2 = s.present.days[1].id;
  s = historyReducer(s, { type: 'stop/move', stopId: two, toDayId: d2, beforeStopId: null });
  assert.deepEqual(names(s, 1), ['three', 'two']);
  s = historyReducer(s, { type: 'stop/remove', stopId: one });
  assert.deepEqual(names(s, 0), []);
  s = historyReducer(s, { type: 'undo' });
  assert.deepEqual(names(s, 0), ['one']);
  s = historyReducer(s, { type: 'redo' });
  assert.deepEqual(names(s, 0), []);
});

test('stream/start pushes old plan to history; revert restores it', () => {
  let s = feed(sample);
  s = historyReducer(s, { type: 'stream/start' });
  assert.equal(s.present.days.length, 0);
  s = historyReducer(s, { type: 'stream/revert' });
  assert.equal(s.present.days.length, 2);
});

test('toBlocks round-trips and renumbers days contiguously', () => {
  let s = feed(sample);
  s = historyReducer(s, { type: 'day/remove', dayId: s.present.days[0].id });
  const b = toBlocks(s.present);
  assert.equal(b.find((x) => x.type === 'day').day, 1);
  assert.equal(b.filter((x) => x.type === 'stop')[0].day, 1);
  assert.equal(b.some((x) => x.id), false);
});

test('checklist toggle is soft (no undo entry)', () => {
  let s = feed(sample);
  const e = s.present.extras[0];
  s = historyReducer(s, { type: 'check/toggle', extraId: e.id, itemId: e.items[0].id });
  assert.equal(s.present.extras[0].items[0].done, true);
  assert.equal(s.past.length, 0);
});
