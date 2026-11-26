import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { db, getPlan, getRuns, getSessions, getStrength } from '@/lib/db';
import { addDays, dayName, diffDays, weekday, fmtDuration, fmtLong, fmtMedium, fmtPace, fmtShort, mondayOf, todayIn } from '@/lib/dates';
import { compliance, currentWeek, matchSessions, phaseProgress, weeklyVolume } from '@/lib/stats';
import { PHASES, distanceFor } from '@/lib/plan';
import AnalysisCard from '@/components/AnalysisCard';
import VolumeChart from '@/components/VolumeChart';
import Donut from '@/components/Donut';
import ConnectedAccounts from '@/components/ConnectedAccounts';
import Icon from '@/components/Icon';

const HARI_PANJANG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()));
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
}

/** Dekorasi: garis lintasan melengkung di pojok kartu gelap */
function Lanes() {
  return (
    <svg viewBox="0 0 300 300" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 text-paper/[0.07]" aria-hidden>
      {[60, 85, 110, 135, 160].map((r) => <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />)}
    </svg>
  );
}

export default async function Dashboard() {
  const user = await requireUser();
  const plan = await getPlan(user.id);
  const today = todayIn(user.timezone);
  const first = user.name.split(' ')[0];
  const head = (
    <div>
      <p className="text-sm text-ink/50">{HARI_PANJANG[weekday(today)]}, {fmtLong(today)}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">{greeting(user.timezone)}, {first}.</h1>
    </div>
  );

  if (!plan) {
    return (
      <div className="space-y-6">
        {head}
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="card relative overflow-hidden bg-ink p-7 text-paper lg:col-span-2">
            <Lanes />
            <p className="text-sm text-paper/60">Langkah pertama</p>
            <h2 className="mt-2 max-w-md font-display text-2xl font-semibold leading-snug">Belum ada rencana latihan. Isi lomba dan target waktumu, jadwalnya kami susun.</h2>
            <Link href="/rencana" className="mt-6 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-volt">
              Buat rencana <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </section>
          <ConnectedAccounts user={user} />
        </div>
      </div>
    );
  }

  const sessions = await getSessions(plan.id);
  const runs = await getRuns(user.id, addDays(mondayOf(plan.start_date), -16 * 7), today);
  const matched = matchSessions(sessions, runs, today, await getStrength(user.id, addDays(plan.start_date, -2), today));
  const vol = weeklyVolume(plan, sessions, runs, today);
  const comp = compliance(matched);
  const phases = phaseProgress(matched);
  const checkpoints = matched.filter((s) => s.type === 'test' || s.type === 'race');
  const daysLeft = Math.max(diffDays(today, plan.race_date), 0);
  const week = currentWeek(plan, today);
  const thisMonday = mondayOf(today);
  const thisWeek = vol.find((v) => v.monday === thisMonday);
  const saved = await db()<{ body: string }[]>`select body from analyses where user_id = ${user.id} and date = ${today}`;
  const dist = distanceFor(plan.race_km);

  const next = matched.find((s) => s.date >= today && s.status !== 'done');
  const nextWhen = next ? (next.date === today ? 'Hari ini' : next.date === addDays(today, 1) ? 'Besok' : `${dayName(next.date)}, ${fmtShort(next.date)}`) : null;
  const curPhase = sessions.find((s) => mondayOf(s.date) === thisMonday)?.phase ?? (today < plan.start_date ? 'Belum mulai' : 'Selesai');
  // lebar tiap fase di bar program = jumlah minggu unik per fase
  const phaseWeeks = PHASES.map((p) => new Set(sessions.filter((s) => s.phase === p).map((s) => s.week)).size);
  const totalPhaseWeeks = Math.max(phaseWeeks.reduce((a, b) => a + b, 0), 1);
  const weekPct = Math.min(100, ((week - (today < plan.start_date ? 1 : 0.5)) / plan.total_weeks) * 100);
  const weekPlan = thisWeek?.rencana ?? 0;
  const weekDone = thisWeek?.aktual ?? 0;

  return (
    <div className="space-y-6">
      {head}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Hitung mundur + sesi berikutnya */}
        <section className="card relative overflow-hidden border-0 bg-ink p-6 text-paper md:p-7 lg:col-span-2">
          <Lanes />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm text-paper/55">{plan.race_name} · {dist.short === 'maraton' ? 'Full Marathon' : dist.label}</p>
              <p className="mt-1 font-display text-xl font-medium text-paper/90">{plan.goal_title || `Target ${fmtDuration(plan.target_sec)}`}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-7xl font-semibold leading-none tracking-tight">{daysLeft}</span>
                <span className="text-paper/60">hari lagi</span>
              </p>
              <p className="mt-2 text-sm text-paper/50">{fmtLong(plan.race_date)}</p>
            </div>
            {next && (
              <div className="w-full rounded-2xl bg-paper/[0.07] p-4 ring-1 ring-paper/10 sm:w-64">
                <p className="flex items-center gap-1.5 text-xs text-volt"><span className="h-1.5 w-1.5 rounded-full bg-volt" />{nextWhen}</p>
                <p className="mt-1.5 font-medium leading-snug">{next.title}</p>
                <p className="mt-1 text-sm text-paper/55">
                  {next.type === 'strength' ? 'Strength' : `${next.distance_km} km`}
                  {next.pace_sec ? ` · ${next.target_sec ? `target ${fmtDuration(next.target_sec)}` : fmtPace(next.pace_sec)}` : ''}
                </p>
                <Link href="/jadwal" className="mt-3 inline-flex items-center gap-1 text-xs text-paper/60 hover:text-paper">
                  Lihat jadwal <Icon name="arrow" className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Bar program per fase */}
          <div className="relative mt-7">
            <div className="mb-2 flex justify-between text-xs text-paper/50">
              <span>Minggu {week} dari {plan.total_weeks}</span>
              <span>Fase {curPhase}</span>
            </div>
            <div className="relative flex h-2 gap-1">
              {PHASES.map((p, i) => phaseWeeks[i] > 0 && (
                <span key={p} className={`h-full rounded-full ${p === curPhase ? 'bg-paper/35' : 'bg-paper/15'}`} style={{ width: `${(phaseWeeks[i] / totalPhaseWeeks) * 100}%` }} />
              ))}
              <span className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-volt" style={{ left: `${weekPct}%` }} />
            </div>
            <div className="mt-1.5 flex gap-1 text-[10px] text-paper/35">
              {PHASES.map((p, i) => phaseWeeks[i] > 0 && <span key={p} style={{ width: `${(phaseWeeks[i] / totalPhaseWeeks) * 100}%` }}>{p}</span>)}
            </div>
          </div>
        </section>

        <ConnectedAccounts user={user} className="lg:row-span-2" />

        {/* Angka minggu ini */}
        <div className="grid gap-5 sm:grid-cols-3 lg:col-span-2">
          <section className="card">
            <p className="muted">Minggu ini</p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{weekDone}<span className="text-base font-normal text-ink/40"> / {weekPlan} km</span></p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
              <div className="h-full rounded-full bg-track" style={{ width: `${weekPlan ? Math.min(100, (weekDone / weekPlan) * 100) : 0}%` }} />
            </div>
          </section>
          <section className="card flex items-center gap-4">
            <Donut {...comp} />
            <div>
              <p className="muted">Kepatuhan</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/50">{comp.done} selesai<br />{comp.missed} terlewat<br />{comp.upcoming} akan datang</p>
            </div>
          </section>
          <section className="card">
            <p className="muted">Checkpoint berikutnya</p>
            {(() => {
              const c = checkpoints.find((x) => x.date >= today && x.status !== 'done');
              if (!c) return <p className="mt-2 text-sm text-ink/50">Tidak ada lagi.</p>;
              const left = diffDays(today, c.date);
              return (
                <>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{left === 0 ? 'Hari ini' : `${left} hari`}</p>
                  <p className="mt-1 truncate text-xs text-ink/50">{c.type === 'race' ? `Lomba ${dist.short}` : c.title}</p>
                </>
              );
            })()}
          </section>
        </div>
      </div>

      <AnalysisCard dateLabel={fmtShort(today)} initial={saved[0]?.body ?? null} />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Volume mingguan</h2>
            <div className="flex gap-4 text-xs text-ink/50">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-track" />Aktual</span>
              <span className="flex items-center gap-1.5"><i className="w-3.5 border-t-2 border-dashed border-ink/40" />Rencana</span>
            </div>
          </div>
          <VolumeChart data={vol} todayMonday={thisMonday} />
        </section>

        <section className="card">
          <h2 className="font-display text-base font-semibold">Progres per fase</h2>
          <div className="mt-4 space-y-4">
            {phases.map((p) => (
              <div key={p.phase}>
                <div className="flex justify-between text-sm">
                  <span className={p.phase === curPhase ? 'font-medium' : 'text-ink/70'}>{p.phase}</span>
                  <span className="text-xs text-ink/45">{p.done}/{p.total}</span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  <span className="bg-track" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                  <span className="bg-bad/60" style={{ width: `${p.total ? (p.missed / p.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="font-display text-base font-semibold">Checkpoint</h2>
        <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">
          {checkpoints.map((c) => {
            const left = diffDays(today, c.date);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-ink/[0.06] py-3 last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.type === 'race' ? 'bg-ink text-volt' : 'bg-track/10 text-track'}`}>
                    <Icon name={c.type === 'race' ? 'flag' : 'bolt'} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{c.type === 'race' ? `Lomba ${dist.short}` : c.title}</p>
                    <p className="text-xs text-ink/45">
                      {fmtMedium(c.date)} · target ≤ {fmtDuration(c.target_sec || 0)}
                      {c.status === 'done' && c.actualKm && c.actualPace ? ` · hasil ${c.actualKm} km @ ${fmtPace(c.actualPace)}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`chip shrink-0 ${c.status === 'done' ? 'bg-ok/10 text-ok' : c.status === 'missed' ? 'bg-bad/10 text-bad' : 'bg-ink/[0.05] text-ink/60'}`}>
                  {c.status === 'done' ? 'Selesai' : c.status === 'missed' ? 'Terlewat' : left === 0 ? 'Hari ini' : `${left} hari`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
