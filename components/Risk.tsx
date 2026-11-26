import { RISK_LABEL, type Risk, type RiskLevel } from '@/lib/plan';

const TONE: Record<RiskLevel, string> = {
  0: 'bg-ok/10 text-ok',
  1: 'bg-volt/25 text-warn',
  2: 'bg-bad/10 text-bad',
  3: 'bg-bad text-white',
};

/** Chip kecil "Risiko: Tinggi" */
export function RiskBadge({ level, prefix = 'Risiko ' }: { level: RiskLevel; prefix?: string }) {
  return <span className={`chip ${TONE[level]}`}>{prefix}{RISK_LABEL[level].toLowerCase()}</span>;
}

/** Panel tingkat risiko + alasannya. Bukan larangan: rencana tetap bisa dibuat. */
export function RiskPanel({ risk, title = 'Tingkat risiko rencana ini' }: { risk: Risk; title?: string }) {
  const bars = [0, 1, 2, 3] as const;
  return (
    <div className={`rounded-xl border p-3.5 ${risk.level >= 2 ? 'border-bad/20 bg-bad/[0.04]' : 'border-ink/[0.07] bg-paper/60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5" aria-hidden>
            {bars.map((b) => (
              <span key={b} className={`h-2 w-4 rounded-sm ${b <= risk.level ? (risk.level >= 2 ? 'bg-bad' : risk.level === 1 ? 'bg-volt' : 'bg-ok') : 'bg-ink/10'}`} />
            ))}
          </span>
          <RiskBadge level={risk.level} prefix="" />
        </div>
      </div>
      {risk.reasons.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink/65">
          {risk.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-ink/55">Lama program, target, dan volume dalam batas wajar.</p>
      )}
    </div>
  );
}
