import Link from 'next/link';
import type { Plan } from '@/lib/db';
import { diffDays } from '@/lib/dates';
import { distanceFor } from '@/lib/plan';

/** Chip pemilih rencana (muncul kalau user punya lebih dari satu rencana). */
export default function PlanSwitcher({ plans, current, today, basePath }: { plans: Plan[]; current: Plan; today: string; basePath: string }) {
  if (plans.length < 2) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Pilih rencana">
      {plans.map((p) => {
        const on = p.id === current.id;
        const left = diffDays(today, p.race_date);
        return (
          <Link key={p.id} href={`${basePath}?plan=${p.id}`} role="tab" aria-selected={on}
            className={`flex shrink-0 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-sm transition ${
              on ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-card text-ink/70 hover:border-ink/25 hover:text-ink'}`}>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-paper/15 text-volt' : 'bg-track/10 text-track'}`}>
              {distanceFor(p.race_km).label.replace(/ \(.*\)/, '').replace('Half Marathon', 'HM').replace('Full Marathon', 'FM')}
            </span>
            <span className="max-w-[12rem] truncate font-medium">{p.race_name}</span>
            <span className={`text-xs ${on ? 'text-paper/55' : 'text-ink/40'}`}>{left >= 0 ? `${left} hari` : 'selesai'}</span>
          </Link>
        );
      })}
      <Link href="/rencana?baru=1" className="flex shrink-0 items-center rounded-full border border-dashed border-ink/20 px-4 py-1.5 text-sm text-ink/50 transition hover:border-ink/40 hover:text-ink">
        + Rencana
      </Link>
    </div>
  );
}
