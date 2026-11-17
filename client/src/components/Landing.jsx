import { PlaneTrail, Compass, Suitcase, Squiggle, Sparkle, Cloud } from './Scenes.jsx';
import { PLACES, photo } from '../lib/places.js';
import { Blossom } from './Decor.jsx';
import { ReviewCards } from './ReviewCards.jsx';
import { lazy, Suspense } from 'react';

const Globe = lazy(() => import('./Globe.jsx'));

// 3D hover tilt: pointer position -> CSS perspective rotation (no re-render, just CSS variables).
function tilt(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 16}deg`);
  el.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 14}deg`);
}
const untilt = (e) => { e.currentTarget.style.setProperty('--ry', '0deg'); e.currentTarget.style.setProperty('--rx', '0deg'); };

function Polaroid({ src, alt, caption, className }) {
  return (
    <figure className={`polaroid ${className}`} onPointerMove={tilt} onPointerLeave={untilt}>
      <div className="polaroid-art"><img src={src} alt={alt} width="800" height="533" loading="lazy" decoding="async" /></div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

// Centered hero: big prompt box in the middle, illustrated scenes + doodles around it, floating reviews below.
export function Landing({ children, onPick }) {
  return (
    <section className="hero">
      <Cloud className="doodle d-cloud1" />
      <Cloud className="doodle d-cloud2" />
      <Sparkle className="doodle d-spark1" />
      <Sparkle size={14} className="doodle d-spark2" />
      <Blossom size={34} className="doodle d-blossom1" />
      <Blossom size={22} className="doodle d-blossom2" />
      <Suitcase className="doodle d-suitcase" />
      <PlaneTrail className="doodle d-plane" />

      <div className="hero-side left">
        <Polaroid className="p1" src="/img/places/shillong.jpg" alt="View over Shillong, Meghalaya" caption="Shillong, Meghalaya" />
        <Polaroid className="p2" src="/img/places/cherry.jpg" alt="Himalayan wild cherry (Prunus cerasoides) in bloom" caption="Himalayan wild cherry in bloom" />
        <Compass className="doodle d-compass" />
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
            <span>{p.name}<small>{p.country}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
