import Link from 'next/link';
import PendingOverlay from '@/components/PendingOverlay';
import { requireUser } from '@/lib/session';
import { getManual, getPlans, getRuns, getSessions, getStrength, pickPlan, type ManualActivity } from '@/lib/db';
import PlanSwitcher from '@/components/PlanSwitcher';
import { deleteManual, logManual } from './actions';
import { addDays, dayName, fmtDuration, fmtPace, fmtShort, mondayOf, todayIn } from '@/lib/dates';
import { matchSessions, type SessionWithStatus } from '@/lib/stats';
import SyncButton from '@/components/SyncButton';

const TYPE_COLOR: Record<string, string> = {
  easy: 'bg-info/15 text-info', recovery: 'bg-info/10 text-info/80', long: 'bg-track text-paper',
  tempo: 'bg-warn/15 text-warn', mp: 'bg-warn/15 text-warn', interval: 'bg-bad/15 text-bad',
  test: 'bg-volt/25 text-warn', race: 'bg-ink text-volt', strength: 'bg-ok/15 text-ok',
};
const STATUS: Record<string, [string, string]> = {
  done: ['Selesai', 'text-ok'], missed: ['Terlewat', 'text-bad'], today: ['Hari ini', 'text-warn'], upcoming: ['', ''],
};

const manualLabel = (m: ManualActivity) =>
  (m.sport_type === 'Run'
    ? `${Math.round(m.distance_m / 100) / 10} km · ${fmtDuration(m.moving_time_s)} · ${fmtPace(m.moving_time_s / (m.distance_m / 1000))}`
    : `Strength${m.moving_time_s ? ` · ${Math.round(m.moving_time_s / 60)} menit` : ''}`) +
  (m.avg_hr ? ` · HR ${Math.round(m.avg_hr)}` : '');

export default async function Jadwal({ searchParams }: { searchParams: { error?: string; plan?: string } }) {
  const user = await requireUser();
  const today = todayIn(user.timezone);
  const plans = await getPlans(user.id);
  const plan = pickPlan(plans, today, searchParams.plan);
  if (!plan) return <section className="card">Belum ada rencana. <Link className="underline" href="/rencana?baru=1">Buat rencana</Link></section>;
  const from = addDays(plan.start_date, -2);
  const sessions = await getSessions(plan.id);
  const runs = await getRuns(user.id, from, today);
  const list = matchSessions(sessions, runs, today, await getStrength(user.id, from, today));
  const weeks = new Map<number, SessionWithStatus[]>();
  list.forEach((s) => weeks.set(s.week, [...(weeks.get(s.week) || []), s]));
  const thisMonday = mondayOf(today);

  // Catatan manual ditampilkan sekali per tanggal, di sesi pertama tanggal itu
  const manual = await getManual(user.id, addDays(today, -90), today);
  const manualByDate = new Map<string, ManualActivity[]>();
  manual.forEach((m) => manualByDate.set(m.local_date, [...(manualByDate.get(m.local_date) || []), m]));
  const firstOfDate = new Set<number>();
  const seen = new Set<string>();
  for (const s of list) if (!seen.has(s.date)) { seen.add(s.date); firstOfDate.add(s.id); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Jadwal</h1>
          <p className="mt-1 text-sm text-ink/50">{plan.race_name} · {plan.total_weeks} minggu</p>
        </div>
        {user.access_token && <SyncButton />}
      </div>
      <PlanSwitcher plans={plans} current={plan} today={today} basePath="/jadwal" />
      {searchParams.error && (
        <p className="rounded-xl border border-bad/20 bg-bad/10 px-4 py-2 text-sm text-bad">{searchParams.error}</p>
      )}
      <details className="card" open={!!searchParams.error}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="font-semibold">Catat lari manual</span>
            <span className="block text-xs text-ink/50">Lupa merekam atau tidak pakai Strava? Isi data aslinya di sini, atau klik <b>Catat</b> di sesi yang sudah lewat.</span>
          </span>
          <span className="btn shrink-0">+ Catat lari</span>
        </summary>
        <form action={logManual} className="mt-4 grid gap-3 sm:grid-cols-3">
          <PendingOverlay label="Menyimpan…" />
          <input type="hidden" name="plan" value={plan.id} />
          <label><span className="label">Jenis</span>
            <select name="kind" className="input"><option value="run">Lari</option><option value="strength">Strength</option></select></label>
          <label><span className="label">Tanggal</span>
            <input name="date" type="date" required defaultValue={today} max={today} min={addDays(today, -90)} className="input" /></label>
          <label><span className="label">Jarak (km, untuk lari)</span>
            <input name="km" inputMode="decimal" placeholder="5" className="input" /></label>
          <label><span className="label">Durasi</span>
            <input name="time" placeholder="lari 32:15 · strength 30 (menit)" className="input" /></label>
          <label><span className="label">HR rata-rata (opsional)</span>
            <input name="hr" type="number" min="60" max="230" className="input" /></label>
          <label><span className="label">Catatan (opsional)</span>
            <input name="note" maxLength={120} placeholder="mis. treadmill" className="input" /></label>
          <div className="sm:col-span-3"><button className="btn">Simpan</button></div>
        </form>
        {manual.length > 0 && (
          <div className="mt-4 border-t border-ink/10 pt-3">
            <p className="label">Catatan manual terakhir</p>
            {manual.slice(-10).reverse().map((m) => (
              <form key={m.id} action={deleteManual} className="flex flex-wrap items-center gap-2 py-1 text-xs text-ink/60">
                <PendingOverlay label="Menghapus…" />
                <input type="hidden" name="plan" value={plan.id} />
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="week" value="" />
                <span className="w-20 text-ink/50">{dayName(m.local_date)} {fmtShort(m.local_date)}</span>
                {manualLabel(m)}
                <button className="text-bad/80 underline hover:text-bad">hapus</button>
              </form>
            ))}
          </div>
        )}
      </details>
      {[...weeks.entries()].map(([w, items]) => {
        const monday = mondayOf(items[0].date);
        const isNow = monday === thisMonday;
        const planned = items.reduce((a, s) => a + s.distance_km, 0);
        const done = items.reduce((a, s) => a + (s.actualKm || 0), 0);
        return (
          <section key={w} id={`w${w}`} className={`card ${isNow ? 'ring-2 ring-track/60' : ''} ${monday < thisMonday ? 'opacity-80' : ''}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display font-semibold">
                Minggu {w} <span className="text-xs font-normal text-ink/50">· {items[0].phase} · {fmtShort(monday)}–{fmtShort(addDays(monday, 6))}</span>
                {isNow && <span className="chip ml-2 bg-volt/25 text-warn">minggu ini</span>}
              </h2>
              <p className="text-xs text-ink/50">rencana {Math.round(planned * 10) / 10} km · selesai {Math.round(done * 10) / 10} km</p>
            </div>
            <ul className="divide-y divide-ink/5">
              {items.map((s) => (
                <li key={s.id} className="grid grid-cols-[88px_1fr_auto] items-start gap-3 py-2 text-sm">
                  <span className="whitespace-nowrap text-ink/60">{dayName(s.date)} {fmtShort(s.date)}</span>
                  <div>
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TYPE_COLOR[s.type] || ''}`}>{s.type}</span>
                    {s.title}{s.type !== 'strength' && <> · {s.distance_km} km</>}
                    {s.pace_sec ? <span className="text-ink/50"> · {s.target_sec ? `target ${fmtDuration(s.target_sec)}` : fmtPace(s.pace_sec)}</span> : null}
                    {s.notes && <p className="text-xs text-ink/40">{s.notes}</p>}

                    {firstOfDate.has(s.id) && manualByDate.get(s.date)?.map((m) => (
                      <form key={m.id} action={deleteManual} className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/60">
                        <PendingOverlay label="Menghapus…" />
                        <input type="hidden" name="plan" value={plan.id} />
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="week" value={w} />
                        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium">manual</span>
                        {manualLabel(m)}
                        <button className="text-bad/80 underline hover:text-bad">hapus</button>
                      </form>
                    ))}

                    {s.date <= today && s.status !== 'done' && (
                      <details className="mt-1">
                        <summary className="btn-ghost cursor-pointer list-none">
                          Catat
                        </summary>
                        <form action={logManual} className="mt-2 grid max-w-md grid-cols-2 gap-2 rounded-xl border border-ink/[0.07] bg-paper/60 p-3 sm:grid-cols-4">
                          <PendingOverlay label="Menyimpan…" />
                          <input type="hidden" name="plan" value={plan.id} />
                          <input type="hidden" name="session_id" value={s.id} />
                          <label className="col-span-2 sm:col-span-1"><span className="label">Tanggal</span>
                            <input name="date" type="date" defaultValue={s.date} max={today} className="input px-2 py-1" /></label>
                          {s.type !== 'strength' && (
                            <label><span className="label">Jarak (km)</span>
                              <input name="km" inputMode="decimal" required defaultValue={s.distance_km} className="input px-2 py-1" /></label>
                          )}
                          <label><span className="label">{s.type === 'strength' ? 'Durasi (menit)' : 'Durasi'}</span>
                            <input name="time" required={s.type !== 'strength'} placeholder={s.type === 'strength' ? '30' : '32:15'} className="input px-2 py-1" /></label>
                          <label><span className="label">HR (opsional)</span>
                            <input name="hr" type="number" min="60" max="230" className="input px-2 py-1" /></label>
                          <label className="col-span-2 sm:col-span-4"><span className="label">Catatan (opsional)</span>
                            <input name="note" maxLength={120} placeholder="mis. treadmill, kaki agak berat" className="input px-2 py-1" /></label>
                          <div className="col-span-2 sm:col-span-4">
                            <button className="btn">Simpan</button>
                          </div>
                        </form>
                      </details>
                    )}
                  </div>
                  {s.type === 'strength' ? (
                    // Strength tidak selalu dicatat di Strava: yang lewat tanpa catatan tampil netral, bukan "Terlewat"
                    <span className={`text-right text-xs ${s.status === 'missed' ? 'text-ink/30' : STATUS[s.status][1]}`}>
                      {s.status === 'missed' ? 'Tidak tercatat' : STATUS[s.status][0]}
                    </span>
                  ) : (
                    <span className={`text-right text-xs ${STATUS[s.status][1]}`}>
                      {STATUS[s.status][0]}
                      {s.status === 'done' && <span className="block text-ink/50">{s.actualKm} km · {fmtPace(s.actualPace)}</span>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
