import { useRef, useState } from 'react';
import { Strawberry, Blossom } from './Decor.jsx';

export const EXAMPLES = [
  'A cosy 4-day food trip to Kyoto in spring, mid budget',
  '3 days in Lisbon with a toddler, slow mornings',
  'Budget-friendly weekend in Hanoi, street food and coffee',
];

export function PromptForm({ onSubmit, busy, onCancel }) {
  const [v, setV] = useState('');
  const ref = useRef(null);
  const submit = (e) => {
    e?.preventDefault();
    if (busy || v.trim().length < 3) return;
    onSubmit(v.trim());
  };
  return (
    <form className="card prompt" onSubmit={submit}>
      <label htmlFor="trip-prompt" className="sr">Describe your trip</label>
      <textarea id="trip-prompt" ref={ref} rows={3} maxLength={1000} value={v} placeholder="Where to, for how long, and what are you into? e.g. 5 days in Seoul, cafés and night markets"
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit(e)} />
      <div className="prompt-foot">
        <div className="examples">
          {EXAMPLES.map((x) => <button type="button" key={x} className="chip btn-chip" onClick={() => { setV(x); ref.current?.focus(); }}>{x.length > 34 ? x.slice(0, 32) + '…' : x}</button>)}
        </div>
        {busy ? (
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel (Esc)</button>
        ) : (
          <button className="btn" disabled={v.trim().length < 3}>Plan my trip</button>
        )}
      </div>
    </form>
  );
}

export function RefineBar({ onSubmit, busy }) {
  const [v, setV] = useState('');
  return (
    <form className="card refine" onSubmit={(e) => { e.preventDefault(); if (!busy && v.trim().length >= 3) { onSubmit(v.trim()); setV(''); } }}>
      <label htmlFor="refine" className="sr">Refine the plan</label>
      <input id="refine" value={v} onChange={(e) => setV(e.target.value)} maxLength={1000} placeholder="Refine: “make it cheaper”, “add a night market on day 2”…" disabled={busy} />
      <button className="btn small" disabled={busy || v.trim().length < 3}>Refine</button>
    </form>
  );
}

export function StatusBar({ planner }) {
  const { status, blocks, dropped } = planner;
  let msg = '';
  if (status === 'loading') msg = 'Asking the model…';
  else if (status === 'retrying') msg = 'Hit a snag, retrying once…';
  else if (status === 'streaming') msg = `Streaming… ${blocks} blocks received`;
  else if (status === 'done' && dropped) msg = `Done. ${dropped} malformed block${dropped > 1 ? 's were' : ' was'} skipped.`;
  return <div className="status" role="status" aria-live="polite">{msg}</div>;
}

export function ErrorPanel({ error, onRetry, onDismiss }) {
  return (
    <div className="card error" role="alert">
      <strong>{error.partial ? 'Generation was interrupted' : "Couldn't generate a plan"}</strong>
      <p>{error.message}{error.partial ? ' Your partial result is kept below.' : ' Your previous plan is untouched.'}</p>
      <div className="detail-actions">
        <button className="btn small" onClick={onRetry}>Retry</button>
        <button className="btn small ghost" onClick={onDismiss}>Dismiss</button>
        <span className="muted code">{error.code}</span>
      </div>
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="itinerary" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="card day skel">
          <div className="sk sk-h" />
          {[0, 1, 2].map((j) => <div key={j} className="sk sk-r" />)}
        </div>
      ))}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-art"><Blossom size={30} /><Strawberry size={96} /><Strawberry size={64} half /><Blossom size={22} /></div>
      <h2>Where to next?</h2>
      <p className="muted">Describe a trip above. The plan streams in as cards you can expand, drag, edit and refine.</p>
    </div>
  );
}

export function SessionsPanel({ sessions, onLoad, onDelete, onNew, onClose }) {
  return (
    <aside className="card sessions" aria-label="Saved trips">
      <div className="sessions-head">
        <h3>Saved trips</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close saved trips">✕</button>
      </div>
      <button className="btn small" onClick={onNew}>＋ New trip</button>
      {!sessions.length && <p className="muted">Nothing saved yet. Plans autosave in this browser.</p>}
      <ul>
        {sessions.map((s) => (
          <li key={s.id}>
            <button className="linkish" onClick={() => onLoad(s)}>
              <strong>{s.plan.title || 'Untitled'}</strong>
              <span className="muted">{new Date(s.updatedAt).toLocaleString()}</span>
            </button>
            <button className="icon-btn" aria-label={`Delete ${s.plan.title}`} onClick={() => onDelete(s.id)}>🗑</button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
