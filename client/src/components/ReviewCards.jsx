import { useEffect, useRef, useState } from 'react';

// Illustrative sample copy for the demo UI, not real customer reviews (each card carries a small "sample" tag).
export const REVIEWS = [
  { name: 'Aarav M.', trip: 'Shillong, 4 days', stars: 5, text: 'Living root bridges at sunrise, Elephant Falls after rain. The day-by-day plan nailed the timing.', tone: 'sh' },
  { name: 'Mei L.', trip: 'Kyoto in spring', stars: 4, text: 'Reordering stops by dragging is addictive. I wish it showed train times, but the route felt right.', tone: 'cb' },
  { name: 'Rohan K.', trip: 'Meghalaya road trip', stars: 5, text: 'Budget chart + packing checklist saved me an evening of spreadsheets.', tone: 'lk' },
  { name: 'Sofia P.', trip: 'Lisbon with a toddler', stars: 4, text: 'Slow mornings, short walks, naps built in. One refine pass fixed an over-packed day two.', tone: 'sh' },
  { name: 'Ishita D.', trip: 'Jaipur, 3 days', stars: 3, text: 'Good skeleton, but a few timings were off. Editing the stops by hand was quick though.', tone: 'cb' },
  { name: 'Kenji T.', trip: 'Bali, 5 days', stars: 5, text: 'Planned the whole trip on my phone in one sitting. Undo saved me twice.', tone: 'lk' },
  { name: 'Nia B.', trip: 'Leh-Ladakh', stars: 4, text: 'Loved that it told me to acclimatise on day one. Costs were estimates, as it says.', tone: 'sh' },
];

export function Stars({ n, size = 16, animate = false }) {
  return (
    <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={animate && i <= n ? 'star-in' : ''} style={{ '--i': i }} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill={i <= n ? 'var(--berry)' : 'none'} stroke={i <= n ? 'var(--berry-deep)' : 'var(--ink)'} strokeWidth="1.4" strokeLinejoin="round" opacity={i <= n ? 1 : 0.3} />
        </svg>
      ))}
    </span>
  );
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Auto-advancing, draggable stack of glass cards. Left/Right arrow keys also work when focused.
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
    if (paused || reduced()) return undefined;
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
        <div className="review-top">
          <Stars n={r.stars} animate={top} />
          <span className="sample-tag">sample</span>
        </div>
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
