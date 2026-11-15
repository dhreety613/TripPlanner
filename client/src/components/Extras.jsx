// Renders the non-itinerary block kinds: checklist, chart, tip. One component per block kind.
export function Extras({ extras, currency, dispatch }) {
  if (!extras.length) return null;
  return (
    <section className="extras" aria-label="Trip extras">
      {extras.map((e) =>
        e.kind === 'checklist' ? <Checklist key={e.id} e={e} dispatch={dispatch} /> :
        e.kind === 'chart' ? <Chart key={e.id} e={e} currency={currency} /> :
        <Tip key={e.id} e={e} />,
      )}
    </section>
  );
}

function Checklist({ e, dispatch }) {
  const done = e.items.filter((i) => i.done).length;
  return (
    <div className="card extra pop">
      <h3>✓ {e.title} <span className="muted">{done}/{e.items.length}</span></h3>
      <ul className="checks">
        {e.items.map((i) => (
          <li key={i.id}>
            <label>
              <input type="checkbox" checked={i.done} onChange={() => dispatch({ type: 'check/toggle', extraId: e.id, itemId: i.id })} />
              <span className={i.done ? 'done' : ''}>{i.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chart({ e, currency }) {
  const max = Math.max(...e.data.map((d) => d.value), 1);
  const total = e.data.reduce((s, d) => s + d.value, 0);
  const unit = e.unit || currency || '';
  return (
    <div className="card extra pop">
      <h3>🍓 {e.title} <span className="muted">total {Math.round(total).toLocaleString()} {unit}</span></h3>
      <ul className="bars">
        {e.data.map((d) => (
          <li key={d.label}>
            <span className="bar-label">{d.label}</span>
            <span className="bar-track" role="img" aria-label={`${d.label}: ${d.value} ${unit}`}>
              <span className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="bar-val">{Math.round(d.value).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tip({ e }) {
  return <div className="card extra tip pop">🌼 {e.text}</div>;
}
