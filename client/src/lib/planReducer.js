// Pure plan state + undo/redo history. No React imports so it is unit-testable with node:test.
let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const emptyPlan = () => ({ title: '', summary: '', currency: 'USD', days: [], extras: [] });
export const isEmpty = (p) => !p.title && p.days.length === 0 && p.extras.length === 0;
export const countStops = (p) => p.days.reduce((s, d) => s + d.stops.length, 0);
export const dayCost = (d) => d.stops.reduce((s, x) => s + (x.cost || 0), 0);

/** Apply one streamed block to a plan (immutable). */
export function applyBlock(plan, b) {
  switch (b.type) {
    case 'trip':
      return { ...plan, title: b.title, summary: b.summary || '', currency: b.currency || plan.currency };
    case 'day': {
      const i = plan.days.findIndex((d) => d.day === b.day);
      if (i >= 0) return { ...plan, days: plan.days.map((d, j) => (j === i ? { ...d, title: b.title } : d)) };
      const days = [...plan.days, { id: uid(), day: b.day, title: b.title, stops: [] }].sort((a, c) => a.day - c.day);
      return { ...plan, days };
    }
    case 'stop': {
      const { type, day, ...rest } = b;
      const stop = { id: uid(), ...rest };
      let days = plan.days;
      if (!days.some((d) => d.day === day))
        days = [...days, { id: uid(), day, title: `Day ${day}`, stops: [] }].sort((a, c) => a.day - c.day);
      return { ...plan, days: days.map((d) => (d.day === day ? { ...d, stops: [...d.stops, stop] } : d)) };
    }
    case 'checklist':
      return { ...plan, extras: [...plan.extras, { id: uid(), kind: 'checklist', title: b.title, items: b.items.map((text) => ({ id: uid(), text, done: false })) }] };
    case 'chart':
      return { ...plan, extras: [...plan.extras, { id: uid(), kind: 'chart', title: b.title, unit: b.unit, data: b.data }] };
    case 'tip':
      return { ...plan, extras: [...plan.extras, { id: uid(), kind: 'tip', text: b.text }] };
    default:
      return plan;
  }
}

/** Inverse of applyBlock: serialise a plan so the server can refine it. */
export function toBlocks(plan) {
  const out = [{ type: 'trip', title: plan.title || 'Trip', summary: plan.summary || undefined, currency: plan.currency }];
  plan.days.forEach((d, i) => {
    // Renumber contiguously so reorders/removals never leave gaps in what the model sees.
    out.push({ type: 'day', day: i + 1, title: d.title });
    for (const s of d.stops) {
      const { id, ...rest } = s;
      out.push({ type: 'stop', day: i + 1, ...rest });
    }
  });
  for (const e of plan.extras) {
    if (e.kind === 'checklist') out.push({ type: 'checklist', title: e.title, items: e.items.map((x) => x.text) });
    else if (e.kind === 'chart') out.push({ type: 'chart', title: e.title, unit: e.unit, data: e.data });
    else if (e.kind === 'tip') out.push({ type: 'tip', text: e.text });
  }
  return out;
}

const findStop = (plan, stopId) => {
  for (const d of plan.days) {
    const i = d.stops.findIndex((s) => s.id === stopId);
    if (i >= 0) return { day: d, index: i, stop: d.stops[i] };
  }
  return null;
};

/** Move a stop to `toDayId`, before `beforeStopId` (or to the end when null). */
export function moveStop(plan, stopId, toDayId, beforeStopId = null) {
  const f = findStop(plan, stopId);
  if (!f || stopId === beforeStopId) return plan;
  const days = plan.days.map((d) => (d.id === f.day.id ? { ...d, stops: d.stops.filter((s) => s.id !== stopId) } : d));
  const out = days.map((d) => {
    if (d.id !== toDayId) return d;
    const at = beforeStopId ? d.stops.findIndex((s) => s.id === beforeStopId) : -1;
    const stops = [...d.stops];
    stops.splice(at < 0 ? stops.length : at, 0, f.stop);
    return { ...d, stops };
  });
  return { ...plan, days: out };
}

/** Move up (-1) / down (+1), crossing day boundaries. */
export function nudgeStop(plan, stopId, dir) {
  const f = findStop(plan, stopId);
  if (!f) return plan;
  const stops = f.day.stops;
  const di = plan.days.findIndex((d) => d.id === f.day.id);
  if (dir < 0) {
    if (f.index > 0) return moveStop(plan, stopId, f.day.id, stops[f.index - 1].id);
    const prev = plan.days[di - 1];
    return prev ? moveStop(plan, stopId, prev.id, null) : plan;
  }
  if (f.index < stops.length - 1) return moveStop(plan, stopId, f.day.id, stops[f.index + 2]?.id ?? null);
  const next = plan.days[di + 1];
  return next ? moveStop(plan, stopId, next.id, next.stops[0]?.id ?? null) : plan;
}

export const initialHistory = { past: [], present: emptyPlan(), future: [] };
const CAP = 50;

const commit = (s, next) =>
  next === s.present ? s : { past: [...s.past.slice(-CAP + 1), s.present], present: next, future: [] };

export function historyReducer(s, a) {
  const p = s.present;
  switch (a.type) {
    // --- streaming lifecycle (the pre-stream plan goes on the undo stack)
    case 'stream/start':
      return { past: isEmpty(p) ? s.past : [...s.past.slice(-CAP + 1), p], present: emptyPlan(), future: [] };
    case 'stream/block':
      return { ...s, present: applyBlock(p, a.block) };
    case 'stream/revert': // failed with nothing received: restore what the user had
      return isEmpty(p) && s.past.length ? { past: s.past.slice(0, -1), present: s.past.at(-1), future: [] } : s;
    case 'load':
      return { past: [], present: a.plan, future: [] };
    case 'undo':
      return s.past.length ? { past: s.past.slice(0, -1), present: s.past.at(-1), future: [p, ...s.future] } : s;
    case 'redo':
      return s.future.length ? { past: [...s.past, p], present: s.future[0], future: s.future.slice(1) } : s;
    // --- user edits (undoable)
    case 'stop/remove':
      return commit(s, { ...p, days: p.days.map((d) => ({ ...d, stops: d.stops.filter((x) => x.id !== a.stopId) })) });
    case 'stop/move':
      return commit(s, moveStop(p, a.stopId, a.toDayId, a.beforeStopId ?? null));
    case 'stop/nudge':
      return commit(s, nudgeStop(p, a.stopId, a.dir));
    case 'stop/update':
      return commit(s, { ...p, days: p.days.map((d) => ({ ...d, stops: d.stops.map((x) => (x.id === a.stopId ? { ...x, ...a.patch } : x)) })) });
    case 'stop/add':
      return commit(s, { ...p, days: p.days.map((d) => (d.id === a.dayId ? { ...d, stops: [...d.stops, { id: uid(), category: 'other', ...a.stop }] } : d)) });
    case 'day/remove':
      return commit(s, { ...p, days: p.days.filter((d) => d.id !== a.dayId) });
    // --- soft edit (not worth an undo step)
    case 'check/toggle':
      return {
        ...s,
        present: { ...p, extras: p.extras.map((e) => (e.id === a.extraId ? { ...e, items: e.items.map((i) => (i.id === a.itemId ? { ...i, done: !i.done } : i)) } : e)) },
      };
    default:
      return s;
  }
}
