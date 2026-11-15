// localStorage session persistence. Every access is guarded: storage can be disabled,
// full, or contain data from an older schema.
const KEY = 'wf.sessions.v1';
const MAX = 30;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter(valid) : [];
  } catch {
    return [];
  }
}

const valid = (s) =>
  s && typeof s.id === 'string' && s.plan && Array.isArray(s.plan.days) && Array.isArray(s.plan.extras) &&
  s.plan.days.every((d) => d && typeof d.id === 'string' && Array.isArray(d.stops));

export const listSessions = () => read().sort((a, b) => b.updatedAt - a.updatedAt);

export function saveSession(session) {
  try {
    const all = read().filter((s) => s.id !== session.id);
    all.push({ ...session, updatedAt: Date.now() });
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  } catch {
    /* quota / disabled: persistence is best-effort */
  }
}

export function deleteSession(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify(read().filter((s) => s.id !== id)));
  } catch {}
}
