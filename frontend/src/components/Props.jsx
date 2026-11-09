// Objets du bureau dessinés en SVG.

const C = {
  duck: "#0b4f5c", deep: "#06262b", light: "#2a8c97", mint: "#8fd3c2",
  cream: "#f3ead8", ochre: "#d9a441", coral: "#e0715a", walnut: "#6b4329",
  brass: "#c9a227", ink: "#13202a",
};

export function Lamp({ on }) {
  return (
    <svg viewBox="0 0 120 130">
      {on && <ellipse cx="60" cy="118" rx="58" ry="10" fill={C.ochre} opacity=".25" />}
      <rect x="30" y="112" width="60" height="10" rx="3" fill={C.brass} />
      <rect x="56" y="58" width="8" height="56" fill={C.brass} />
      <path d="M14 58 Q60 14 106 58 Z" fill={C.duck} stroke={C.deep} strokeWidth="2" />
      <path d="M22 54 Q60 24 98 54" fill="none" stroke={C.light} strokeWidth="3" opacity=".7" />
      <rect x="14" y="56" width="92" height="6" rx="3" fill={on ? "#ffe9a8" : "#8a8170"} />
      <line x1="80" y1="62" x2="82" y2="86" stroke={C.brass} strokeWidth="1.5" />
      <circle cx="82" cy="88" r="3" fill={C.brass} />
    </svg>
  );
}

export function Plant() {
  return (
    <svg viewBox="0 0 110 130">
      <g fill={C.mint}>
        <ellipse cx="38" cy="48" rx="20" ry="8" transform="rotate(-35 38 48)" />
        <ellipse cx="72" cy="40" rx="22" ry="8" transform="rotate(30 72 40)" />
        <ellipse cx="54" cy="24" rx="7" ry="20" />
        <ellipse cx="28" cy="72" rx="18" ry="7" transform="rotate(-10 28 72)" fill={C.light} />
        <ellipse cx="82" cy="66" rx="18" ry="7" transform="rotate(15 82 66)" fill={C.light} />
      </g>
      <path d="M55 92 Q50 60 38 48 M55 92 Q60 56 72 40 M55 92 L54 24" stroke={C.duck} strokeWidth="2.5" fill="none" />
      <path d="M30 86 L80 86 L72 126 L38 126 Z" fill={C.coral} />
      <rect x="26" y="82" width="58" height="10" rx="2" fill="#c85c47" />
    </svg>
  );
}

export function Notebook() {
  return (
    <svg viewBox="0 0 120 130">
      <rect x="22" y="14" width="78" height="104" rx="6" fill={C.duck} />
      <rect x="22" y="14" width="10" height="104" rx="3" fill={C.deep} />
      <rect x="96" y="18" width="6" height="96" fill={C.cream} opacity=".9" />
      <rect x="74" y="14" width="5" height="104" fill={C.ink} opacity=".75" />
      <path d="M50 118 L50 128 L55 124 L60 128 L60 118 Z" fill={C.coral} />
      <rect x="44" y="40" width="40" height="22" rx="2" fill="none" stroke={C.brass} strokeWidth="1.5" />
      <line x1="50" y1="48" x2="78" y2="48" stroke={C.brass} strokeWidth="1.5" />
      <line x1="50" y1="54" x2="70" y2="54" stroke={C.brass} strokeWidth="1.5" />
    </svg>
  );
}

export function Deck() {
  return (
    <svg viewBox="0 0 130 130">
      {[-18, -6, 6].map((r, i) => (
        <g key={i} transform={`rotate(${r} 65 110)`}>
          <rect x="40" y="26" width="52" height="76" rx="6" fill={C.cream} stroke={C.deep} strokeWidth="1.5" />
          <rect x="45" y="31" width="42" height="66" rx="3" fill="none" stroke={i === 2 ? C.duck : C.light} strokeWidth="1.5" />
        </g>
      ))}
      <g transform="rotate(6 65 110)">
        <text x="66" y="72" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="22" fill={C.duck}>Aa</text>
        <text x="50" y="44" fontFamily="Karla, sans-serif" fontSize="8" fontWeight="700" fill={C.coral}>EN</text>
      </g>
    </svg>
  );
}

export function Typewriter() {
  return (
    <svg viewBox="0 0 150 130">
      <rect x="44" y="8" width="62" height="44" fill={C.cream} />
      {[18, 26, 34].map((y) => <line key={y} x1="52" y1={y} x2={y === 34 ? 80 : 98} y2={y} stroke={C.light} strokeWidth="2" />)}
      <rect x="22" y="44" width="106" height="14" rx="7" fill={C.ink} />
      <circle cx="20" cy="51" r="8" fill={C.brass} />
      <circle cx="130" cy="51" r="8" fill={C.brass} />
      <path d="M18 60 L132 60 L144 118 L6 118 Z" fill={C.duck} />
      <path d="M18 60 L132 60 L134 70 L16 70 Z" fill={C.light} opacity=".6" />
      {[0, 1, 2].map((row) =>
        Array.from({ length: 9 - row }, (_, k) => (
          <circle key={`${row}-${k}`} cx={30 + row * 6 + k * 12} cy={80 + row * 11} r="4.2" fill={C.cream} stroke={C.ink} strokeWidth="1" />
        )),
      )}
      <rect x="44" y="108" width="62" height="5" rx="2.5" fill={C.cream} />
    </svg>
  );
}

export function Chest() {
  return (
    <svg viewBox="0 0 140 130">
      <path d="M14 56 Q14 24 70 24 Q126 24 126 56 Z" fill={C.walnut} />
      <rect x="14" y="56" width="112" height="62" rx="4" fill="#5a3722" />
      <rect x="14" y="54" width="112" height="6" fill={C.brass} />
      {[30, 110].map((x) => <rect key={x} x={x - 4} y="26" width="8" height="92" fill={C.brass} opacity=".85" />)}
      <rect x="58" y="50" width="24" height="24" rx="3" fill={C.brass} />
      <path d="M62 50 L62 42 Q70 32 78 42 L78 50" fill="none" stroke={C.brass} strokeWidth="4" />
      <circle cx="70" cy="60" r="3" fill={C.ink} />
      <rect x="68.5" y="61" width="3" height="7" fill={C.ink} />
    </svg>
  );
}
