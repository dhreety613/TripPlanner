// Original, hand-drawn-style SVG decor (strawberry + blossom) matching the watercolor palette.
export function Strawberry({ size = 64, half = false, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 58C16 50 8 36 11 26c2-7 10-9 21-9s19 2 21 9c3 10-5 24-21 32z" fill="var(--berry)" />
      <path d="M32 58C16 50 8 36 11 26c2-7 10-9 21-9s19 2 21 9c3 10-5 24-21 32z" fill="url(#bl)" opacity=".5" />
      {half && <path d="M32 24c-6 6-9 16-3 28 6-12 9-22 3-28z" fill="var(--cream)" opacity=".85" />}
      {!half && [[22, 30], [32, 27], [42, 30], [26, 40], [38, 40], [32, 49]].map(([x, y], i) => <path key={i} d={`M${x} ${y}q2 3 0 5`} stroke="var(--berry-deep)" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
      <path d="M32 18c-3-6-9-9-15-8 3 4 7 7 15 8zM32 18c3-6 9-9 15-8-3 4-7 7-15 8zM32 18c-1-5 0-9 2-12 2 3 2 8-2 12z" fill="var(--leaf)" />
      <defs>
        <radialGradient id="bl" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function Blossom({ size = 28, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="16" cy="9" rx="5.2" ry="7" fill="var(--blossom)" stroke="var(--line)" strokeWidth=".8" transform={`rotate(${r} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="3.4" fill="var(--sun)" />
    </svg>
  );
}
