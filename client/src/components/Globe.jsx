import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Interactive 3D globe (three.js). Drag to spin, hover a pin for its name, click a pin (or its button)
// to rotate to it and pre-fill the prompt. Pauses when off-screen / tab hidden; honours reduced motion;
// falls back to a static card if WebGL is unavailable. Colours are read from the CSS theme variables.
export const PLACES = [
  { name: 'Shillong', lat: 25.57, lon: 91.88, prompt: '4 days in Shillong, Meghalaya: waterfalls, living root bridges and cosy cafés, mid budget' },
  { name: 'Kyoto', lat: 35.01, lon: 135.77, prompt: 'A cosy 4-day food trip to Kyoto in spring, mid budget' },
  { name: 'Lisbon', lat: 38.72, lon: -9.14, prompt: '3 days in Lisbon with a toddler, slow mornings' },
  { name: 'Hanoi', lat: 21.03, lon: 105.85, prompt: 'Budget-friendly weekend in Hanoi, street food and coffee' },
  { name: 'Cusco', lat: -13.53, lon: -71.97, prompt: '5 days in Cusco and the Sacred Valley, acclimatise slowly, mid budget' },
];

const R = 1;
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

export default function Globe({ onPick, className = '' }) {
  const mount = useRef(null);
  const label = useRef(null);
  const api = useRef({});
  const [failed, setFailed] = useState(() => !webglOk());
  const [active, setActive] = useState(null);

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
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    camera.position.set(0, 0, 4.1);
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

    // --- pins, hit targets, pulse rings
    const pinMat = new THREE.MeshBasicMaterial();
    const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const pinGeo = new THREE.SphereGeometry(0.032, 16, 12);
    const hitGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const ringGeo = new THREE.RingGeometry(0.04, 0.052, 32);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const pins = PLACES.map((p, idx) => {
      const pos = toVec(p.lat, p.lon, R * 1.005);
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(pos);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.copy(pos);
      hit.userData.idx = idx;
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      globe.add(pin, hit, ring);
      return { pos, pin, hit, ring, p };
    });

    // --- route arcs between neighbouring pins, drawn progressively
    const arcMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
    const arcs = [];
    for (let i = 0; i < PLACES.length - 1; i++) {
      const a = pins[i].pos;
      const b = pins[i + 1].pos;
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1 + 0.28 * a.distanceTo(b)));
      const pts2 = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(64);
      const g = new THREE.BufferGeometry().setFromPoints(pts2);
      g.setDrawRange(0, 0);
      const line = new THREE.Line(g, arcMat);
      globe.add(line);
      arcs.push({ g, n: pts2.length, t: -i * 0.35 });
    }

    // --- theme colours (re-read when data-theme flips)
    const applyTheme = () => {
      coreMat.color.copy(cssColor('--paper', '#fcf8ee'));
      haloMat.color.copy(cssColor('--blush', '#f6cdd1'));
      dotMat.color.copy(cssColor('--leaf-deep', '#44703a'));
      gratMat.color.copy(cssColor('--leaf', '#5f8f4c'));
      pinMat.color.copy(cssColor('--berry', '#e2677a'));
      ringMat.color.copy(cssColor('--berry', '#e2677a'));
      arcMat.color.copy(cssColor('--sun', '#e9c23d'));
    };
    applyTheme();
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // --- state
    const st = { yaw: -rad(90), pitch: 0.35, vy: 0, vp: 0, drag: false, moved: 0, lx: 0, ly: 0, target: null, hover: -1, visible: true, last: performance.now() };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const calm = reducedMotion();

    const rotateTo = (idx) => {
      const p = PLACES[idx];
      st.target = { yaw: -rad(p.lon), pitch: Math.max(-0.9, Math.min(0.9, rad(p.lat))) };
    };
    api.current.rotateTo = rotateTo;

    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([core, ...pins.map((x) => x.hit)], false)[0];
      return hit && hit.object.userData.idx !== undefined ? hit.object.userData.idx : -1;
    };

    const dom = renderer.domElement;
    const onDown = (e) => {
      st.drag = true;
      st.moved = 0;
      st.lx = e.clientX;
      st.ly = e.clientY;
      st.target = null;
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
        const h = pick(e);
        if (h !== st.hover) {
          st.hover = h;
          dom.style.cursor = h >= 0 ? 'pointer' : 'grab';
          if (label.current) {
            label.current.style.opacity = h >= 0 ? '1' : '0';
            if (h >= 0) label.current.textContent = PLACES[h].name;
          }
        }
      }
    };
    const onUp = (e) => {
      const wasClick = st.drag && st.moved < 6;
      st.drag = false;
      dom.style.cursor = st.hover >= 0 ? 'pointer' : 'grab';
      if (wasClick) {
        const h = pick(e);
        if (h >= 0) {
          rotateTo(h);
          setActive(h);
          onPick?.(PLACES[h]);
        }
      }
    };
    const onLeave = () => {
      st.hover = -1;
      if (label.current) label.current.style.opacity = '0';
    };
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
        if (!calm && st.hover < 0) st.yaw += dt * 0.18;
      }
      globe.rotation.set(st.pitch, st.yaw, 0);
      halo.rotation.copy(globe.rotation);

      const tt = now / 1000;
      pins.forEach((x, i) => {
        const k = (tt * 0.7 + i * 0.4) % 1;
        x.ring.scale.setScalar(1 + k * 2.2);
        x.ring.material.opacity = 0.6 * (1 - k);
        const grow = i === st.hover ? 1.5 : 1;
        x.pin.scale.setScalar(x.pin.scale.x + (grow - x.pin.scale.x) * 0.2);
        // fade pins/rings that face away from the camera
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
      arcs.forEach((a) => {
        a.t += dt * 0.35;
        const p = Math.max(0, Math.min(1, a.t % 2.6 < 1.6 ? (a.t % 2.6) / 1.6 : 1));
        a.g.setDrawRange(0, Math.floor(p * a.n));
      });
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
      [coreMat, haloMat, dotMat, gratMat, pinMat, ringMat, arcMat, hitMat].forEach((m) => m.dispose());
      [dotGeo, gratGeo, pinGeo, hitGeo, ringGeo, core.geometry, halo.geometry, ...arcs.map((a) => a.g)].forEach((g) => g.dispose());
      renderer.dispose();
      dom.remove();
    };
  }, [failed, onPick]);

  const choose = (i) => {
    setActive(i);
    api.current.rotateTo?.(i);
    onPick?.(PLACES[i]);
  };

  return (
    <div className={`globe-wrap ${className}`}>
      {failed ? (
        <div className="globe-fallback" role="img" aria-label="Globe unavailable on this device">🌍</div>
      ) : (
        <div className="globe-canvas" ref={mount}>
          <div className="globe-label" ref={label} aria-hidden="true" />
        </div>
      )}
      <div className="globe-chips" role="group" aria-label="Pick a destination">
        {PLACES.map((p, i) => (
          <button key={p.name} type="button" className={`chip btn-chip${active === i ? ' on' : ''}`} onClick={() => choose(i)} aria-pressed={active === i}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
