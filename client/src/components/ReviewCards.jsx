import { useEffect, useRef, useState } from 'react';

// Illustrative sample copy for the demo UI, not real customer reviews.
export const REVIEWS = [
  { name: 'Aarav M.', trip: 'Shillong, 4 days', stars: 5, text: 'Living root bridges at sunrise, Elephant Falls after rain. The day-by-day plan nailed the timing.', tone: 'sh' },
  { name: 'Mei L.', trip: 'Cherry Blossom Festival, Shillong', stars: 5, text: 'Asked for pink streets and cafés. Got a route I could drag around until it felt right.', tone: 'cb' },
  { name: 'Rohan K.', trip: 'Meghalaya road trip', stars: 4, text: 'Budget chart + packing checklist saved me an evening of spreadsheets.', tone: 'lk' },
  { name: 'Sofia P.', trip: 'Lisbon with a toddler', stars: 5, text: 'Slow mornings, short walks, naps built in. I just said “make it calmer” and it re-planned.', tone: 'sh' },
  { name: 'Kenji T.', trip: 'Kyoto in spring', stars: 5, text: 'Reordering stops by dragging is addictive. Planned the whole trip on my phone.', tone: 'cb' },
];

export function Stars({ n, size = 16 }) {
  return (
    <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill={i <= n ? 'var(--sun)' : 'none'} stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" opacity={i <= n ? 1 : 0.35} />
        </svg>
      ))}
    </span>
  );
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ReviewCards() {
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const [out, setOut] = useState(0); // -1 | 1 while flung off-screen
  const [paused, setPaused] = useState(false);
  const start = useRef(null);
  const n = REVIEWS.length;

  const go = (dir) => {
    setOut(dir);
    setTimeout(() => {
      setI((v) => (v + (dir > 0 ? 1 : -1) + n) % n);
      setOut(0);
      setDx(0);
    }, 260);
  };

  useEffect(() => {
    if (paused || reduced()) return;
    const t = setInterval(() => go(1), 5200);
    return () => clearInterval(t);
  }, [paused, i]);

  const onDown = (e) => {
    start.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPaused(true);
  };
  const onMove = (e) => start.current != null && setDx(e.clientX - start.current);
  const onUp = () => {
    const d = dx;
    start.current = null;
    setPaused(false);
    if (Math.abs(d) > 80) go(d < 0 ? 1 : -1);
    else setDx(0);
  };

  const card = (k, depth) => {
    const r = REVIEWS[(i + k) % n];
    const top = depth === 0;
    const x = top ? (out ? out * -420 : dx) : 0;
    const style = {
      transform: `translateX(${x}px) rotate(${top ? x / 22 : (depth % 2 ? 2.4 : -2.4) * depth}deg) translateY(${depth * 10}px) scale(${1 - depth * 0.05})`,
      zIndex: 10 - depth,
      opacity: out && top ? 0 : 1 - depth * 0.18,
      transition: start.current != null ? 'none' : 'transform .26s ease, opacity .26s ease',
    };
    return (
      <article
        key={`${i}-${k}`}
        className={`review ${r.tone} ${top ? 'top' : ''}`}
        style={style}
        {...(top ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp } : { 'aria-hidden': true })}
      >
        <Stars n={r.stars} />
        <p>“{r.text}”</p>
        <footer>
          <span className="avatar" aria-hidden="true">{r.name[0]}</span>
          <span><strong>{r.name}</strong><br /><small>{r.trip}</small></span>
        </footer>
      </article>
    );
  };

  return (
    <section
      className="reviews"
      aria-roledescription="carousel"
      aria-label="Traveller reviews (sample). Left and right arrow keys change the review"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'ArrowRight' ? go(1) : e.key === 'ArrowLeft' ? go(-1) : null)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => start.current == null && setPaused(false)}
    >
      <div className="review-stack">{[2, 1, 0].map((d) => card(d, d))}</div>
    </section>
  );
}
