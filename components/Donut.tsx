// Warna = token tema (lihat app/globals.css); rgb() langsung karena atribut SVG tidak membaca CSS variable lewat Tailwind
const TRACK = 'rgb(34 84 66)', BAD = 'rgb(196 78 56)', REST = 'rgba(24,26,27,0.08)', INK = 'rgb(24 26 27)';

export default function Donut({ done, missed, upcoming, pct }: { done: number; missed: number; upcoming: number; pct: number }) {
  const total = Math.max(done + missed + upcoming, 1);
  const r = 54, c = 2 * Math.PI * r;
  const segs = [
    { v: done, color: TRACK },
    { v: missed, color: BAD },
  ];
  let off = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-20 w-20 shrink-0 -rotate-90" role="img" aria-label={`${pct}% sesi selesai`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke={REST} strokeWidth="14" />
      {segs.map((s, i) => {
        const len = (s.v / total) * c;
        const el = len > 0 && <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="14"
          strokeDasharray={`${len} ${c}`} strokeDashoffset={-off} />;
        off += len;
        return el;
      })}
      <g className="rotate-90" style={{ transformOrigin: '70px 70px' }}>
        <text x="70" y="80" textAnchor="middle" fill={INK} fontSize="32" fontWeight="600" fontFamily="var(--font-display)">{pct}%</text>
      </g>
    </svg>
  );
}
