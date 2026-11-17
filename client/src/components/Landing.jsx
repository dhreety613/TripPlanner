import { lazy, Suspense } from 'react';
import { PlaneTrail, Squiggle, Cloud, CuteBerry } from './Scenes.jsx';
import { ReviewCards } from './ReviewCards.jsx';
import { PLACES, photo } from '../lib/places.js';

const Globe = lazy(() => import('./Globe.jsx'));

// Photos in the slow, endlessly scrolling column on the left.
const REEL = [
  { src: '/img/places/shillong.jpg', alt: 'View over Shillong, Meghalaya', caption: 'Shillong, Meghalaya' },
  { src: '/img/places/cherry.jpg', alt: 'Himalayan wild cherry (Prunus cerasoides) in bloom', caption: 'Himalayan wild cherry in bloom' },
  { src: '/img/places/darjeeling.jpg', alt: 'Tea plantation hills near Darjeeling', caption: 'Darjeeling tea hills' },
  { src: '/img/places/leh.jpg', alt: 'Pangong Lake, Ladakh', caption: 'Pangong Lake, Ladakh' },
  { src: '/img/places/kyoto.jpg', alt: 'Fushimi Inari torii gates, Kyoto', caption: 'Fushimi Inari, Kyoto' },
];

// 3D hover tilt: pointer position -> CSS perspective rotation (no re-render, just CSS variables).
function tilt(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 16}deg`);
  el.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 14}deg`);
}
const untilt = (e) => {
  e.currentTarget.style.setProperty('--ry', '0deg');
  e.currentTarget.style.setProperty('--rx', '0deg');
};

function Polaroid({ src, alt, caption, rot }) {
  return (
    <figure className="polaroid" style={{ '--rot': `${rot}deg` }} onPointerMove={tilt} onPointerLeave={untilt}>
      <div className="polaroid-art">
        <img src={src} alt={alt} width="800" height="533" loading="lazy" decoding="async" />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

// The reel is rendered twice and translated by -50% in CSS, so the loop is seamless. The copy is aria-hidden.
function Reel() {
  const group = (hidden) => (
    <div className="reel-group" aria-hidden={hidden || undefined}>
      {REEL.map((p, i) => (
        <Polaroid key={p.src} {...p} rot={i % 2 ? 3.5 : -4} />
      ))}
    </div>
  );
  return (
    <div className="marquee" role="group" aria-label="Photos of Shillong, Darjeeling, Ladakh and Kyoto">
      <div className="marquee-track">
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

// Centered hero: big prompt box in the middle, a slow photo reel on the left, the trending globe on the right.
export function Landing({ children, onPick }) {
  return (
    <section className="hero">
      <Cloud className="doodle d-cloud1" />
      <Cloud className="doodle d-cloud2" />
      <CuteBerry size={46} className="doodle d-berry1" />
      <CuteBerry size={34} wink className="doodle d-berry2" />
      <CuteBerry size={40} half className="doodle d-berry3" />
      <CuteBerry size={30} className="doodle d-berry4" />
      <PlaneTrail className="doodle d-plane" />

      <div className="hero-side left">
        <Reel />
      </div>

      <div className="hero-center">
        <p className="eyebrow">AI trip planner</p>
        <h1>
          Plan your next <span className="ul">voyage<Squiggle className="ul-svg" /></span>
        </h1>
        <p className="lede">Describe a trip in plain words. Get an itinerary you can drag, edit and refine, with budget and packing built in.</p>
        {children}
        <ReviewCards />
      </div>

      <div className="hero-side right">
        <Suspense fallback={<div className="globe-wrap"><div className="globe-fallback" aria-hidden="true">🌍</div></div>}>
          <Globe onPick={onPick} />
        </Suspense>
      </div>

      {/* Phones: tappable photo strip of the trending places (tap = write that trip) */}
      <div className="hero-strip" role="group" aria-label="Trending destinations">
        {PLACES.map((p) => (
          <button key={p.id} type="button" className="strip-card" onClick={() => onPick?.(p)}>
            <img src={photo(p)} alt="" width="800" height="533" loading="lazy" decoding="async" />
            <span>
              {p.name}
              <small>{p.country}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
