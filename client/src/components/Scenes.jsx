// Original inline-SVG doodles (no external assets, CSP-safe).

// Kawaii strawberry: leaves, seeds, a tiny smile and blush. `half` shows a cut berry.
export function CuteBerry({ size = 56, className = '', half = false, wink = false }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 59C15 51 7 36 10.5 25.5c2.2-7 10.5-9.5 21.5-9.5s19.300 2.500 21.500 9.500C57 36 49 51 32 59z" fill="var(--berry)" stroke="var(--berry-deep)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M17 26c1-5 6-7 12-7.500" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" fill="none" opacity=".55" />
      {half && <path d="M32 24c-7 6-10 17-3 30 7-13 10-24 3-30z" fill="var(--cream)" opacity=".9" />}
      {[[20, 33], [44, 33], [27, 47], [38, 47], [32, 53]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.300" ry="2" fill="#fff" opacity=".7" transform={`rotate(${i % 2 ? 20 : -20} ${x} ${y})`} />
      ))}
      <circle cx="24" cy="38" r="3.300" fill="#ff9aa9" opacity=".75" />
      <circle cx="40" cy="38" r="3.300" fill="#ff9aa9" opacity=".75" />
      <ellipse cx="26" cy="34" rx="1.900" ry="2.400" fill="#4a2a30" />
      {wink ? <path d="M37 34h4.200" stroke="#4a2a30" strokeWidth="2" strokeLinecap="round" /> : <ellipse cx="38" cy="34" rx="1.900" ry="2.400" fill="#4a2a30" />}
      <path d="M28.500 41.500q3.500 3.500 7 0" stroke="#4a2a30" strokeWidth="1.800" strokeLinecap="round" fill="none" />
      <path d="M32 17c-3-6-10-9-16-7.500 3.500 4.500 8.500 7 16 7.500zM32 17c3-6 10-9 16-7.500-3.500 4.500-8.500 7-16 7.500zM32 17c-1.500-5-.5-9 2-12 2.500 3 2 8-2 12z" fill="var(--leaf)" stroke="var(--leaf-deep)" strokeWidth="1.200" strokeLinejoin="round" />
    </svg>
  );
}

export function PlaneTrail({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 240 90" aria-hidden="true">
      <path d="M6 78 C50 70 60 20 110 30 S170 70 206 30" fill="none" stroke="var(--leaf-deep)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      <path d="M206 30 l26 -10 l-8 24 l-6 -9 l-12 -3z" fill="var(--berry)" stroke="var(--berry-deep)" strokeWidth="1.400" strokeLinejoin="round" />
    </svg>
  );
}

export function Squiggle({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 24" aria-hidden="true">
      <path d="M4 14 q10 -14 20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="var(--berry)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Cloud({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 90 40" aria-hidden="true">
      <path d="M20 34 a12 12 0 0 1 2 -23 a16 16 0 0 1 30 -2 a13 13 0 0 1 18 14 a10 10 0 0 1 -2 11z" fill="var(--card)" stroke="var(--line)" strokeWidth="2" />
    </svg>
  );
}
