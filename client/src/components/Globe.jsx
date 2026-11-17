import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PLACES, COUNTS, photo } from '../lib/places.js';

// "Trending now" 3D globe (three.js). 13 curated destinations (6 India, 7 abroad).
// Drag to spin, hover a dot for its photo card, click a dot: the globe turns + zooms to it, a flight arc is drawn
// from the previous pick, and the trip is written into the prompt box (typewriter, see PromptForm).
// Pauses when off-screen / tab hidden; honours reduced motion; falls back if WebGL is unavailable.
const R = 1;
const Z_FAR = 4.1;
const Z_NEAR = 3.5;
const rad = (d) => (d * Math.PI) / 180;
const toVec = (lat, lon, r = R) => new THREE.Vector3(r * Math.cos(rad(lat)) * Math.sin(rad(lon)), r * Math.sin(rad(lat)), r * Math.cos(rad(lat)) * Math.cos(rad(lon)));
const cssColor = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return new THREE.Color(v || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
};
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const webglOk = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

export default function Globe({ onPick }) {
  const mount = useRef(null);
  const label = useRef(null);
  const api = useRef({});
  const [failed, setFailed] = useState(() => !webglOk());
  const [active, setActive] = useState(0); // selected place (drives the photo card)
  const [hover, setHover] = useState(-1);

  useEffect(() => {
    if (failed || !mount.current) return undefined;
    const el = mount.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    const dom = renderer.domElement;
    dom.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
    dom.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    camera.position.set(0, 0, Z_FAR);
    const globe = new THREE.Group();
    scene.add(globe);

    // --- core + atmosphere
    const coreMat = new THREE.MeshBasicMaterial();
    const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 32), coreMat);
    const haloMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, opacity: 0.55 });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 48, 32), haloMat);
    globe.add(core);
    scene.add(halo);

    // --- dotted surface (Fibonacci sphere) + graticule
    const N = 1700;
    const pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = Math.PI * (3 - Math.sqrt(5)) * i;
      pts.set([Math.cos(t) * r * R, y * R, Math.sin(t) * r * R], i * 3);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dotMat = new THREE.PointsMaterial({ size: 0.021, sizeAttenuation: true, transparent: true, opacity: 0.95 });
    globe.add(new THREE.Points(dotGeo, dotMat));

    const grat = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let k = 0; k < 96; k++) grat.push(toVec(lat, (k / 96) * 360), toVec(lat, ((k + 1) / 96) * 360));
    for (let lon = 0; lon < 360; lon += 30) for (let k = 0; k < 48; k++) grat.push(toVec(-90 + (k / 48) * 180, lon), toVec(-90 + ((k + 1) / 48) * 180, lon));
    const gratGeo = new THREE.BufferGeometry().setFromPoints(grat);
    const gratMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 });
    globe.add(new THREE.LineSegments(gratGeo, gratMat));

    // --- pins: India = berry, abroad = sky. One ring material per pin so pulses fade independently.
    const pinMats = { india: new THREE.MeshBasicMaterial(), world: new THREE.MeshBasicMaterial() };
    const pinGeo = new THREE.SphereGeometry(0.026, 16, 12);
    const hitGeo = new THREE.SphereGeometry(0.05, 10, 8);
    const ringGeo = new THREE.RingGeometry(0.034, 0.045, 32);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const ringMats = [];
    const pins = PLACES.map((p, idx) => {
      const pos = toVec(p.lat, p.lon, R * 1.004);
      const pin = new THREE.Mesh(pinGeo, pinMats[p.region]);
      pin.position.copy(pos);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.copy(pos);
      hit.userData.idx = idx;
      const rm = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      ringMats.push(rm);
      const ring = new THREE.Mesh(ringGeo, rm);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      globe.add(pin, hit, ring);
      return { pos, pin, hit, ring, rm, p };
    });

    // --- one "flight" arc, redrawn from the previous pick to the new one
    const arcMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95 });
    const arcGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const arc = new THREE.Line(arcGeo, arcMat);
    arc.visible = false;
    globe.add(arc);
    const arcState = { n: 0, t: 1 };
    const flyArc = (from, to) => {
      const a = pins[from].pos;
      const b = pins[to].pos;
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1 + 0.32 * a.distanceTo(b)));
      const pts2 = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(72);
      arc.geometry.dispose();
      arc.geometry = new THREE.BufferGeometry().setFromPoints(pts2);
      arc.geometry.setDrawRange(0, 0);
      arcState.n = pts2.length;
      arcState.t = 0;
      arc.visible = true;
    };

    // --- theme colours (re-read when data-theme flips)
    const applyTheme = () => {
      coreMat.color.copy(cssColor('--paper', '#fcf8ee'));
      haloMat.color.copy(cssColor('--blush', '#f6cdd1'));
      dotMat.color.copy(cssColor('--leaf-deep', '#44703a'));
      gratMat.color.copy(cssColor('--leaf', '#5f8f4c'));
      pinMats.india.color.copy(cssColor('--berry', '#e2677a'));
      pinMats.world.color.copy(cssColor('--sky', '#3d93b8'));
      pins.forEach((x) => x.rm.color.copy(x.p.region === 'india' ? pinMats.india.color : pinMats.world.color));
      arcMat.color.copy(cssColor('--sun', '#e9c23d'));
    };
    applyTheme();
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // --- state (kept in a plain object so the render loop never touches React)
    const calm = reducedMotion();
    const st = { yaw: -rad(80), pitch: 0.4, vy: 0, vp: 0, drag: false, moved: 0, lx: 0, ly: 0, target: null, zt: Z_FAR, hover: -1, active: 0, visible: true, last: performance.now() };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const select = (idx, fromUser) => {
      const p = PLACES[idx];
      if (idx !== st.active && !calm) flyArc(st.active, idx);
      st.active = idx;
      st.target = { yaw: -rad(p.lon), pitch: Math.max(-0.9, Math.min(0.9, rad(p.lat))) };
      st.zt = Z_NEAR;
      setActive(idx);
      if (fromUser) onPick?.(p);
    };
    api.current.select = (i) => select(i, true);

    const pick = (e) => {
      const r = dom.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([core, ...pins.map((x) => x.hit)], false)[0];
      return hit && hit.object.userData.idx !== undefined ? hit.object.userData.idx : -1;
    };
    const setHoverIdx = (h) => {
      if (h === st.hover) return;
      st.hover = h;
      setHover(h);
      dom.style.cursor = h >= 0 ? 'pointer' : st.drag ? 'grabbing' : 'grab';
      if (label.current) {
        label.current.style.opacity = h >= 0 ? '1' : '0';
        if (h >= 0) label.current.textContent = PLACES[h].name;
      }
    };

    const onDown = (e) => {
      st.drag = true;
      st.moved = 0;
      st.lx = e.clientX;
      st.ly = e.clientY;
      st.target = null;
      st.zt = Z_FAR;
      dom.setPointerCapture?.(e.pointerId);
      dom.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (st.drag) {
        const dx = e.clientX - st.lx;
        const dy = e.clientY - st.ly;
        st.lx = e.clientX;
        st.ly = e.clientY;
        st.moved += Math.abs(dx) + Math.abs(dy);
        st.vy = dx * 0.006;
        st.vp = dy * 0.004;
        st.yaw += st.vy;
        st.pitch = Math.max(-0.9, Math.min(0.9, st.pitch + st.vp));
      } else {
        setHoverIdx(pick(e));
      }
    };
    const onUp = (e) => {
      const wasClick = st.drag && st.moved < 6;
      st.drag = false;
      dom.style.cursor = st.hover >= 0 ? 'pointer' : 'grab';
      if (wasClick) {
        const h = pick(e);
        if (h >= 0) select(h, true);
      }
    };
    const onLeave = () => setHoverIdx(-1);
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    dom.addEventListener('pointerleave', onLeave);

    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const io = new IntersectionObserver(([en]) => (st.visible = en.isIntersecting), { threshold: 0.01 });
    io.observe(el);

    const tmp = new THREE.Vector3();
    let raf = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!st.visible || document.hidden) {
        st.last = now;
        return;
      }
      const dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;
      if (st.target) {
        let dy = st.target.yaw - st.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        st.yaw += dy * Math.min(1, dt * 5);
        st.pitch += (st.target.pitch - st.pitch) * Math.min(1, dt * 5);
        if (Math.abs(dy) < 0.004) st.target = null;
      } else if (!st.drag) {
        st.vy *= 0.94;
        st.vp *= 0.9;
        st.yaw += st.vy;
        st.pitch = Math.max(-0.9, Math.min(0.9, st.pitch + st.vp));
        if (!calm && st.hover < 0 && st.zt === Z_FAR) st.yaw += dt * 0.15;
      }
      camera.position.z += (st.zt - camera.position.z) * Math.min(1, dt * 4);
      globe.rotation.set(st.pitch, st.yaw, 0);
      halo.rotation.copy(globe.rotation);

      const tt = now / 1000;
      pins.forEach((x, i) => {
        const k = (tt * 0.7 + i * 0.37) % 1;
        const isAct = i === st.active;
        x.ring.scale.setScalar(1 + k * (isAct ? 3.4 : 2.2));
        x.rm.opacity = (isAct ? 0.9 : 0.55) * (1 - k);
        const grow = i === st.hover || isAct ? 1.55 : 1;
        x.pin.scale.setScalar(x.pin.scale.x + (grow - x.pin.scale.x) * 0.2);
        tmp.copy(x.pos).applyEuler(globe.rotation);
        const vis = tmp.z > -0.05;
        x.pin.visible = x.ring.visible = vis;
        if (i === st.hover && label.current && vis) {
          tmp.project(camera);
          const w = dom.clientWidth;
          const h = dom.clientHeight;
          label.current.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h - 14}px) translate(-50%, -100%)`;
        }
      });
      if (arc.visible && arcState.t < 1) {
        arcState.t = Math.min(1, arcState.t + dt / 1.1);
        arc.geometry.setDrawRange(0, Math.floor(arcState.t * arcState.n));
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObs.disconnect();
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('pointerleave', onLeave);
      [coreMat, haloMat, dotMat, gratMat, hitMat, arcMat, pinMats.india, pinMats.world, ...ringMats].forEach((m) => m.dispose());
      [dotGeo, gratGeo, pinGeo, hitGeo, ringGeo, core.geometry, halo.geometry, arc.geometry].forEach((g) => g.dispose());
      renderer.dispose();
      dom.remove();
    };
  }, [failed, onPick]);

  const choose = (i) => (api.current.select ? api.current.select(i) : (setActive(i), onPick?.(PLACES[i])));
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      choose((active + (e.key === 'ArrowRight' ? 1 : -1) + PLACES.length) % PLACES.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    }
  };
  const shown = PLACES[hover >= 0 ? hover : active];
  return (
    <div className="globe-wrap">
      <div className="trend-head">
        <h2 className="trend-title">Trending now</h2>
        <p className="trend-legend">
          <span><i className="dot india" />India {COUNTS.india}</span>
          <span><i className="dot world" />Abroad {COUNTS.world}</span>
        </p>
      </div>

      <div
        className="globe-stage"
        tabIndex={0}
        role="group"
        aria-roledescription="globe"
        aria-label="Trending destinations globe. Use the left and right arrow keys to choose a destination."
        onKeyDown={onKey}
      >
        {failed ? (
          <div className="globe-fallback" aria-hidden="true">
            <i />
          </div>
        ) : (
          <div className="globe-canvas" ref={mount}>
            <div className="globe-label" ref={label} aria-hidden="true" />
          </div>
        )}
      </div>

      <figure className="place-card" key={shown.id} aria-live="polite">
        <img src={photo(shown)} alt={`${shown.name}, ${shown.country}`} width="800" height="533" loading="lazy" decoding="async" />
        <figcaption>
          <strong>{shown.name}<small>{shown.country}</small></strong>
          <span>{shown.tag}</span>
        </figcaption>
      </figure>
      <p className="globe-hint muted">Click a dot and the trip writes itself in the box</p>

      <a className="credits muted" href="/credits.html" target="_blank" rel="noopener">Photo credits</a>
    </div>
  );
}
