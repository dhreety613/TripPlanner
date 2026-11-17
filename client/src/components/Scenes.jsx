// Original illustrated scenes + doodles (inline SVG, no external images, CSP-safe).

export function ShillongScene() {
  return (
    <svg viewBox="0 0 300 200" role="img" aria-label="Illustration: misty pine hills and a waterfall, Shillong">
      <defs>
        <linearGradient id="sh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9c2" />
          <stop offset="1" stopColor="#fff1de" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#sh-sky)" />
      <circle cx="226" cy="52" r="20" fill="#ffb86b" opacity=".9" />
      <path d="M0 120 Q50 70 105 108 T210 96 T300 118 V200 H0Z" fill="#a9c79a" />
      <path d="M0 140 Q70 96 130 130 T300 128 V200 H0Z" fill="#7fae74" />
      <path d="M180 100 Q186 128 184 150" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".9" />
      <path d="M0 165 Q80 140 160 160 T300 150 V200 H0Z" fill="#4f8a55" />
      {[[26, 148], [50, 156], [76, 150], [236, 146], [262, 154], [286, 146]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 -26 L9 -8 H4 L12 6 H-12 L-4 -8 H-9Z" fill="#2f6b3f" />
          <rect x="-1.5" y="6" width="3" height="7" fill="#6b4a2b" />
        </g>
      ))}
      <ellipse cx="90" cy="132" rx="60" ry="7" fill="#fff" opacity=".45" />
      <ellipse cx="220" cy="150" rx="55" ry="6" fill="#fff" opacity=".4" />
    </svg>
  );
}

export function CherryScene() {
  const blooms = [[110, 70, 20], [140, 52, 22], [172, 66, 20], [124, 92, 19], [158, 94, 21], [96, 94, 14], [190, 90, 14], [142, 74, 24]];
  return (
    <svg viewBox="0 0 300 200" role="img" aria-label="Illustration: cherry blossom tree">
      <defs>
        <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d6e6" />
          <stop offset="1" stopColor="#fdeee8" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#cb-sky)" />
      <path d="M0 140 Q60 100 120 132 T300 120 V200 H0Z" fill="#c9d9ef" opacity=".7" />
      <path d="M0 165 Q100 140 200 160 T300 156 V200 H0Z" fill="#a8c98f" />
      <path d="M146 168 C142 140 150 120 140 96 M141 112 C128 104 120 96 112 90 M146 108 C158 100 166 94 174 90" stroke="#6b4a3a" strokeWidth="6" fill="none" strokeLinecap="round" />
      {blooms.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? '#f7a8c4' : '#fbc3d6'} opacity=".92" />
      ))}
      {[[70, 120], [92, 150], [214, 118], [236, 148], [190, 138], [58, 96]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4" ry="2.4" fill="#f7a8c4" transform={`rotate(${i * 40} ${x} ${y})`} />
      ))}
    </svg>
  );
}

export function LakeScene() {
  return (
    <svg viewBox="0 0 300 200" role="img" aria-label="Illustration: snow peaks above a calm lake">
      <defs>
        <linearGradient id="lk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe0f2" />
          <stop offset="1" stopColor="#f3f8e8" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#lk-sky)" />
      <path d="M0 120 L70 50 L112 96 L160 36 L226 110 L262 76 L300 112 V130 H0Z" fill="#7f9fb8" />
      <path d="M160 36 L140 62 L152 58 L160 68 L170 56 L182 62Z M70 50 L58 68 L70 64 L80 70Z" fill="#fff" />
      <rect y="124" width="300" height="76" fill="#7fc0d6" />
      <path d="M0 128 L70 168 L112 140 L160 178 L226 134 L262 158 L300 132 V200 H0Z" fill="#5e97b0" opacity=".45" />
      {[40, 110, 190, 250].map((x, i) => (
        <path key={i} d={`M${x} ${150 + i * 6} h${22 - i * 2}`} stroke="#fff" strokeWidth="1.6" opacity=".7" strokeLinecap="round" />
      ))}
      <circle cx="248" cy="40" r="14" fill="#ffe08a" />
    </svg>
  );
}

export function PlaneTrail({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 240 90" aria-hidden="true">
      <path d="M6 78 C50 70 60 20 110 30 S170 70 206 30" fill="none" stroke="var(--leaf-deep)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      <path d="M206 30 l26 -10 l-8 24 l-6 -9 l-12 -3z" fill="var(--berry)" stroke="var(--berry-deep)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Compass({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke="var(--leaf-deep)" strokeWidth="2.4" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="var(--leaf-deep)" strokeWidth="1" strokeDasharray="1 4" />
      <path d="M32 12 L38 32 L32 52 L26 32Z" fill="var(--berry)" stroke="var(--berry-deep)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M32 12 L38 32 L26 32Z" fill="var(--blush)" />
      <circle cx="32" cy="32" r="2.6" fill="var(--ink)" />
    </svg>
  );
}

export function Suitcase({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 56" aria-hidden="true">
      <path d="M22 14 V9 a4 4 0 0 1 4 -4 h12 a4 4 0 0 1 4 4 v5" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="6" y="14" width="52" height="34" rx="7" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2.4" />
      <path d="M6 28 H58" stroke="var(--ink)" strokeWidth="2" opacity=".5" />
      <rect x="28" y="25" width="8" height="8" rx="2" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.8" />
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

export function Sparkle({ size = 22, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4Z" fill="var(--sun)" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
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
