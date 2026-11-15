import { useEffect, useRef, useState } from 'react';
import { countStops, dayCost } from '../lib/planReducer.js';
import { CATEGORIES } from '@trip/shared';
import { Extras } from './Extras.jsx';

const ICON = { food: '🍓', sight: '🏛️', activity: '🚲', transport: '🚆', lodging: '🛏️', other: '✨' };
const money = (n, cur) => (n ? `${Math.round(n).toLocaleString()} ${cur}` : 'Free');

export function ItineraryView({ plan, dispatch, locked, streaming }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null); // stop id or `day:<id>`
  const focusId = useRef(null);

  // After a keyboard move the card may remount (cross-day); put focus back on it.
  useEffect(() => {
    if (!focusId.current) return;
    document.querySelector(`[data-stop-id="${focusId.current}"]`)?.focus();
    focusId.current = null;
  });

  const total = plan.days.reduce((s, d) => s + dayCost(d), 0);
  const drop = (toDayId, beforeStopId) => {
    if (dragId) dispatch({ type: 'stop/move', stopId: dragId, toDayId, beforeStopId });
    setDragId(null);
    setOver(null);
  };

  return (
    <div className="itinerary">
      <header className="trip-head pop">
        <h2>{plan.title || 'Planning…'}</h2>
        {plan.summary && <p>{plan.summary}</p>}
        <p className="chips">
          <span className="chip">{plan.days.length} days</span>
          <span className="chip">{countStops(plan)} stops</span>
          <span className="chip">≈ {money(total, plan.currency)} pp</span>
          {streaming && <span className="chip live">● streaming</span>}
        </p>
      </header>

      {plan.days.map((d) => (
        <section key={d.id} className={`card day pop ${over === `day:${d.id}` ? 'drop-target' : ''}`}
          aria-label={`Day ${d.day}`}
          onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(`day:${d.id}`); } }}
          onDrop={(e) => { e.preventDefault(); drop(d.id, null); }}>
          <DayHeader d={d} plan={plan} locked={locked} dispatch={dispatch} />
          <ol className="stops">
            {d.stops.map((s, i) => (
              <StopCard key={s.id} s={s} plan={plan} dayId={d.id} first={i === 0 && d === plan.days[0]}
                last={i === d.stops.length - 1 && d === plan.days.at(-1)} cur={plan.currency}
                locked={locked} dragging={dragId === s.id} over={over === s.id}
                onDragStart={() => setDragId(s.id)} onDragEnd={() => { setDragId(null); setOver(null); }}
                onOver={() => dragId && dragId !== s.id && setOver(s.id)}
                onDropBefore={() => drop(d.id, s.id)}
                dispatch={dispatch} focusId={focusId} />
            ))}
          </ol>
          {!d.stops.length && <p className="muted empty-day">{streaming ? 'Adding stops…' : 'No stops. Drag one here or add your own.'}</p>}
          {!locked && <AddStop onAdd={(name) => dispatch({ type: 'stop/add', dayId: d.id, stop: { name } })} />}
        </section>
      ))}

      <Extras extras={plan.extras} currency={plan.currency} dispatch={dispatch} />
    </div>
  );
}

function DayHeader({ d, locked, dispatch }) {
  return (
    <div className="day-head">
      <h3><span className="day-badge">Day {d.day}</span> {d.title}</h3>
      <span className="muted">{money(dayCost(d), '')}</span>
      {!locked && (
        <button className="icon-btn" aria-label={`Remove day ${d.day}`} title="Remove day" onClick={() => dispatch({ type: 'day/remove', dayId: d.id })}>🗑</button>
      )}
    </div>
  );
}

function StopCard({ s, plan, dayId, first, last, cur, locked, dragging, over, onDragStart, onDragEnd, onOver, onDropBefore, dispatch, focusId }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);

  const onKey = (e) => {
    if (e.target !== e.currentTarget) return; // ignore keys typed into inner inputs
    if (locked) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      focusId.current = s.id;
      dispatch({ type: 'stop/nudge', stopId: s.id, dir: e.key === 'ArrowUp' ? -1 : 1 });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'stop/remove', stopId: s.id });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };
  const nudge = (dir) => { focusId.current = s.id; dispatch({ type: 'stop/nudge', stopId: s.id, dir }); };

  return (
    <li className={`stop ${dragging ? 'dragging' : ''} ${over ? 'over' : ''}`} tabIndex={0} data-stop-id={s.id} onKeyDown={onKey}
      aria-expanded={open} aria-label={`${s.name}${s.time ? ` at ${s.time}` : ''}. Enter to expand, Alt+arrows to move, Delete to remove.`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onOver(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropBefore(); }}>
      <div className="stop-row">
        {!locked && (
          <span className="handle" draggable aria-hidden="true" title="Drag to reorder"
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.setDragImage(e.currentTarget.closest('.stop'), 20, 20); onDragStart(); }}
            onDragEnd={onDragEnd}>⋮⋮</span>
        )}
        <button className="stop-main" onClick={() => setOpen(!open)} tabIndex={-1} aria-hidden="true">
          <span className="time">{s.time || '—'}</span>
          <span className="ico">{ICON[s.category] || ICON.other}</span>
          <span className="name">{s.name}</span>
          <span className="muted cost">{money(s.cost, cur)}</span>
          <span className="caret">{open ? '▾' : '▸'}</span>
        </button>
        {!locked && (
          <span className="stop-actions">
            <button className="icon-btn" aria-label={`Move ${s.name} up`} disabled={first} onClick={() => nudge(-1)}>↑</button>
            <button className="icon-btn" aria-label={`Move ${s.name} down`} disabled={last} onClick={() => nudge(1)}>↓</button>
            <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => dispatch({ type: 'stop/remove', stopId: s.id })}>✕</button>
          </span>
        )}
      </div>
      {open && (
        <div className="stop-detail">
          {edit ? (
            <EditForm s={s} onCancel={() => setEdit(false)} onSave={(patch) => { dispatch({ type: 'stop/update', stopId: s.id, patch }); setEdit(false); }} />
          ) : (
            <>
              {s.description && <p>{s.description}</p>}
              {s.tip && <p className="tipline">🌼 {s.tip}</p>}
              <p className="muted meta">
                {s.category}{s.durationMin ? ` · ${s.durationMin} min` : ''}
              </p>
              {!locked && (
                <div className="detail-actions">
                  <button className="btn small ghost" onClick={() => setEdit(true)}>Edit</button>
                  <label className="move-to">
                    Move to
                    <select value={dayId} onChange={(e) => dispatch({ type: 'stop/move', stopId: s.id, toDayId: e.target.value, beforeStopId: null })}>
                      {plan.days.map((d) => <option key={d.id} value={d.id}>Day {d.day}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function EditForm({ s, onSave, onCancel }) {
  const [f, setF] = useState({ name: s.name, time: s.time || '', cost: s.cost ?? '', category: s.category || 'other', description: s.description || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    onSave({ name: f.name.trim().slice(0, 120), time: f.time.trim() || undefined, category: f.category, cost: f.cost === '' || isNaN(+f.cost) ? undefined : Math.max(0, +f.cost), description: f.description.trim().slice(0, 500) || undefined });
  };
  return (
    <form className="edit" onSubmit={submit}>
      <input aria-label="Name" value={f.name} onChange={set('name')} maxLength={120} required />
      <div className="edit-row">
        <input aria-label="Time" placeholder="HH:MM" value={f.time} onChange={set('time')} maxLength={20} />
        <input aria-label="Cost" type="number" min="0" placeholder="Cost" value={f.cost} onChange={set('cost')} />
        <select aria-label="Category" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <textarea aria-label="Description" rows={2} value={f.description} onChange={set('description')} maxLength={500} />
      <div className="detail-actions"><button className="btn small">Save</button><button type="button" className="btn small ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function AddStop({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  if (!open) return <button className="btn small ghost add" onClick={() => setOpen(true)}>＋ Add stop</button>;
  return (
    <form className="add-form" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onAdd(v.trim().slice(0, 120)); setV(''); setOpen(false); }}>
      <input autoFocus aria-label="New stop name" placeholder="Stop name" value={v} onChange={(e) => setV(e.target.value)} maxLength={120} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
      <button className="btn small">Add</button>
    </form>
  );
}
