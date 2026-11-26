'use client';
import { useEffect, useRef, useState } from 'react';
import { RISK_LABEL, programWeeks, weeksRisk, type RiskLevel } from '@/lib/plan';

const TONE: Record<RiskLevel, string> = { 0: 'text-ok', 1: 'text-warn', 2: 'text-bad', 3: 'text-bad' };

/**
 * Pratinjau langsung di form rencana: lama program dari tanggal mulai -> tanggal lomba, dan risikonya.
 * Membaca isian race_km, race_date, start_date dari form induknya.
 */
export default function WeeksRiskPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<{ weeks: number; level: RiskLevel; reason: string | null } | null>(null);

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const read = () => {
      const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
      const km = Number(get('race_km')), race = get('race_date'), start = get('start_date');
      if (!km || !/^\d{4}-\d{2}-\d{2}$/.test(race) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || race < start) return setV(null);
      const weeks = programWeeks(start, race);
      setV({ weeks, ...weeksRisk(km, weeks) });
    };
    read();
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    return () => { form.removeEventListener('input', read); form.removeEventListener('change', read); };
  }, []);

  return (
    <div ref={ref} aria-live="polite" className="sm:col-span-2">
      {v && (
        <p className="rounded-xl bg-paper px-3 py-2 text-xs leading-relaxed text-ink/60">
          Lama program <b className="text-ink">{v.weeks} minggu</b> ·{' '}
          <b className={TONE[v.level]}>risiko {RISK_LABEL[v.level].toLowerCase()}</b>
          {v.reason && <span className="mt-0.5 block">{v.reason}</span>}
        </p>
      )}
    </div>
  );
}
