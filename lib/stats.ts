import type { Activity, Plan, SessionRow } from './db';
import { addDays, diffDays, mondayOf, monthLabel } from './dates';
import { PHASES } from './plan';

export type Status = 'done' | 'missed' | 'today' | 'upcoming';
export interface SessionWithStatus extends SessionRow {
  status: Status;
  actualKm: number | null;
  actualPace: number | null;
  actualHr: number | null;
}

interface DayRun {
  km: number;
  sec: number;
  hrSum: number;
  hrN: number;
  used: boolean;
}

function groupRuns(runs: Activity[]) {
  const m = new Map<string, DayRun>();
  for (const r of runs) {
    const d = m.get(r.local_date) || { km: 0, sec: 0, hrSum: 0, hrN: 0, used: false };
    d.km += r.distance_m / 1000;
    d.sec += r.moving_time_s;
    if (r.avg_hr) {
      d.hrSum += r.avg_hr * r.moving_time_s;
      d.hrN += r.moving_time_s;
    }
    m.set(r.local_date, d);
  }
  return m;
}

export const isStrength = (s: { type: string }) => s.type === 'strength';

/** Sesi per tanggal, untuk mencari sesi kemarin / besok dari tanggal sebuah aktivitas */
function byDate<T extends { date: string }>(list: T[]) {
  const m = new Map<string, T[]>();
  for (const s of list) m.set(s.date, [...(m.get(s.date) || []), s]);
  return m;
}

/**
 * Mencocokkan aktivitas dengan sesi rencana:
 * 1) Aktivitas di tanggal yang sama dengan sesinya.
 * 2) Aktivitas yang belum terpakai dan tanggalnya beda sehari: diutamakan ke sesi SEBELUMNYA (H-1, latihan yang telat).
 *    Kalau sesi H-1 sudah selesai (atau tidak ada), masuk ke sesi BERIKUTNYA (H+1, latihan yang dimajukan).
 * Sesi lari butuh jarak ≥50% rencana atau ≥3 km. Sesi strength cukup ada aktivitas strength Strava (WeightTraining, Workout, …).
 */
export function matchSessions(sessions: SessionRow[], runs: Activity[], today: string, strength: Activity[] = []): SessionWithStatus[] {
  const days = groupRuns(runs);
  const enough = (s: SessionRow, d: DayRun) => d.km >= Math.min(s.distance_km * 0.5, 3);
  const all: SessionWithStatus[] = sessions.map((s) => ({ ...s, status: 'upcoming', actualKm: null, actualPace: null, actualHr: null }));
  const res = all.filter((s) => !isStrength(s));
  const open = (s: SessionWithStatus) => s.status !== 'done';

  // Strength: jumlah aktivitas per tanggal, tiap aktivitas mencentang satu sesi
  const sDates = new Map<string, number>();
  for (const a of strength) sDates.set(a.local_date, (sDates.get(a.local_date) || 0) + 1);
  const strengthByDate = byDate(all.filter(isStrength));
  for (const [date, list] of strengthByDate) {
    for (const r of list) {
      const n = sDates.get(date) || 0;
      if (n > 0) { sDates.set(date, n - 1); r.status = 'done'; }
    }
  }
  for (const date of [...sDates.keys()].sort()) {
    for (const alt of [addDays(date, -1), addDays(date, 1)]) {
      while ((sDates.get(date) || 0) > 0) {
        const r = strengthByDate.get(alt)?.find(open);
        if (!r) break;
        r.status = 'done';
        sDates.set(date, (sDates.get(date) || 0) - 1);
      }
    }
  }

  const fill = (r: SessionWithStatus, d: DayRun) => {
    d.used = true;
    r.status = 'done';
    r.actualKm = Math.round(d.km * 10) / 10;
    r.actualPace = d.km > 0 ? d.sec / d.km : null;
    r.actualHr = d.hrN ? Math.round(d.hrSum / d.hrN) : null;
  };

  // 1) tanggal sama
  for (const r of res) {
    if (r.date > today) continue;
    const d = days.get(r.date);
    if (d && !d.used && enough(r, d)) fill(r, d);
  }
  // 2) beda sehari: lari yang belum terpakai → sesi kemarin dulu, kalau sudah selesai → sesi besok
  const runByDate = byDate(res);
  for (const date of [...days.keys()].sort()) {
    const d = days.get(date)!;
    if (d.used) continue;
    for (const alt of [addDays(date, -1), addDays(date, 1)]) {
      const r = runByDate.get(alt)?.find((s) => open(s) && enough(s, d));
      if (r) {
        fill(r, d);
        break;
      }
    }
  }
  for (const r of all) {
    if (r.status !== 'done') r.status = r.date < today ? 'missed' : r.date === today ? 'today' : 'upcoming';
  }
  return all;
}

export interface WeekPoint {
  monday: string;
  label: string;
  aktual: number | null;
  rencana: number | null;
}

export function weeklyVolume(plan: Plan, sessions: SessionRow[], runs: Activity[], today: string, historyWeeks = 16): WeekPoint[] {
  const planStart = mondayOf(plan.start_date);
  const first = addDays(planStart, -historyWeeks * 7);
  const last = mondayOf(plan.race_date);
  const thisWeek = mondayOf(today);
  const actual = new Map<string, number>();
  for (const r of runs) {
    const k = mondayOf(r.local_date);
    actual.set(k, (actual.get(k) || 0) + r.distance_m / 1000);
  }
  const planned = new Map<string, number>();
  for (const s of sessions) {
    const k = mondayOf(s.date);
    planned.set(k, (planned.get(k) || 0) + s.distance_km);
  }
  const out: WeekPoint[] = [];
  let prevMonth = '';
  for (let m = first; m <= last; m = addDays(m, 7)) {
    const mon = monthLabel(addDays(m, 3));
    out.push({
      monday: m,
      label: mon !== prevMonth && out.length > 0 ? mon : '',
      aktual: m <= thisWeek ? Math.round((actual.get(m) || 0) * 10) / 10 : null,
      rencana: m >= planStart ? Math.round((planned.get(m) || 0) * 10) / 10 : null,
    });
    prevMonth = mon;
  }
  return out;
}

/** Kepatuhan dihitung dari sesi lari saja (strength tidak selalu dicatat di Strava) */
export function compliance(all: SessionWithStatus[]) {
  const list = all.filter((s) => !isStrength(s));
  const done = list.filter((s) => s.status === 'done').length;
  const missed = list.filter((s) => s.status === 'missed').length;
  const upcoming = list.length - done - missed;
  return { done, missed, upcoming, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}

export function phaseProgress(list: SessionWithStatus[]) {
  return PHASES.map((phase) => {
    const items = list.filter((s) => s.phase === phase && !isStrength(s));
    return { phase, total: items.length, done: items.filter((s) => s.status === 'done').length, missed: items.filter((s) => s.status === 'missed').length };
  });
}

export function currentWeek(plan: Plan, today: string) {
  const w = Math.floor(diffDays(mondayOf(plan.start_date), mondayOf(today)) / 7) + 1;
  return Math.min(Math.max(w, 1), plan.total_weeks);
}
