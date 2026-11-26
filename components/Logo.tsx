/** Logo: dua lengkung lintasan + titik pelari, wordmark huruf kecil. */
export default function Logo({ size = 'md', invert = false }: { size?: 'md' | 'lg'; invert?: boolean }) {
  const lg = size === 'lg';
  const s = lg ? 36 : 28;
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="LariKita">
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill={invert ? 'rgb(var(--paper))' : 'rgb(var(--track))'} />
        <path d="M8 22a8 8 0 0 1 16 0" fill="none" stroke={invert ? 'rgb(var(--track))' : 'rgb(var(--paper))'} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 22a4 4 0 0 1 8 0" fill="none" stroke={invert ? 'rgb(var(--track) / .45)' : 'rgb(var(--paper) / .5)'} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="22.6" cy="10.4" r="2.6" fill="rgb(var(--volt))" />
      </svg>
      <span className={`font-display font-semibold tracking-tight ${lg ? 'text-2xl' : 'text-lg'} ${invert ? 'text-paper' : 'text-ink'}`}>
        lari<span className="text-track">kita</span>
      </span>
    </span>
  );
}
