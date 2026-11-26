/**
 * Overlay loading layar penuh: logo LariKita dengan titik pelari yang mengitari lintasan.
 * Muncul setelah jeda singkat (lihat .overlay-in di globals.css) supaya tidak berkedip saat proses cepat.
 */
export default function LoadingOverlay({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite"
      className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-paper/70 backdrop-blur-[3px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink/[0.07] bg-card px-7 py-6 shadow-[0_20px_50px_-20px_rgb(var(--ink)/0.25)]">
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
          <rect width="52" height="52" rx="14" fill="rgb(var(--track))" />
          <circle cx="26" cy="26" r="13" fill="none" stroke="rgb(var(--paper) / .18)" strokeWidth="3" />
          <g className="origin-center animate-[spin_1.1s_linear_infinite]" style={{ transformOrigin: '26px 26px' }}>
            <circle cx="26" cy="26" r="13" fill="none" stroke="rgb(var(--paper))" strokeWidth="3" strokeLinecap="round" strokeDasharray="22 60" />
            <circle cx="39" cy="26" r="3.2" fill="rgb(var(--volt))" />
          </g>
        </svg>
        <p className="text-sm font-medium text-ink/70">{label}</p>
      </div>
    </div>
  );
}
