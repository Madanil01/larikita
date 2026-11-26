import { addDays, diffDays, mondayOf, fmtDuration, fmtPace } from './dates';

export const MARATHON_KM = 42.195;
export const PHASES = ['Base', 'Build', 'Spesifik', 'Taper'] as const;
export type Phase = (typeof PHASES)[number];
export type SessionType = 'easy' | 'long' | 'tempo' | 'mp' | 'interval' | 'recovery' | 'test' | 'race' | 'strength';

/** Label jenis sesi (dipakai di form ubah/tambah sesi) */
export const SESSION_TYPES: Record<SessionType, string> = {
  easy: 'Easy', long: 'Long run', tempo: 'Tempo', interval: 'Interval', mp: 'Pace lomba',
  recovery: 'Recovery', test: 'Tes', race: 'Lomba', strength: 'Strength',
};
export const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
/** Pilihan hari default (0 = Senin) kalau user belum memilih */
export const DEFAULT_DAYS: Record<number, number[]> = { 3: [1, 3, 6], 4: [1, 3, 5, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };

// ---- Kategori jarak lomba ----
export interface DistanceConfig {
  km: number;
  label: string; // label lengkap
  short: string; // dipakai di judul sesi, mis. "pace 10K"
  defaultTarget: string;
  minWeeks: number;
  peakFactor: number; // pengali volume puncak dibanding program maraton
  longCap: [number, number]; // batas long run km: [fase Base, fase berikutnya]
  longHours: number; // batas durasi long run
  raceWeekFactor: number; // sisa volume minggu lomba (di luar lomba)
  specific: { title: string; notes: string }; // sesi pace lomba di fase Spesifik
  longRpMaxKm: number; // maks km pace lomba di akhir long run (0 = tidak ada)
  longReadyKm: number; // long run terpanjang minimal supaya siap lomba (di bawah ini: tampilkan peringatan)
}

export const DISTANCES: DistanceConfig[] = [
  {
    km: 5, label: '5K', short: '5K', defaultTarget: '0:30:00', minWeeks: 4, peakFactor: 0.6,
    longCap: [10, 14], longHours: 1.5, raceWeekFactor: 0.55,
    specific: { title: 'Repetisi pace 5K (5-6x1 km)', notes: 'Jogging 2 menit antar repetisi.' }, longRpMaxKm: 0, longReadyKm: 0,
  },
  {
    km: 10, label: '10K', short: '10K', defaultTarget: '1:00:00', minWeeks: 6, peakFactor: 0.7,
    longCap: [14, 18], longHours: 1.75, raceWeekFactor: 0.5,
    specific: { title: 'Repetisi pace 10K (3x3 km)', notes: 'Jogging 3 menit antar repetisi.' }, longRpMaxKm: 0, longReadyKm: 0,
  },
  {
    km: 21.0975, label: 'Half Marathon (21K)', short: 'HM', defaultTarget: '2:15:00', minWeeks: 8, peakFactor: 0.85,
    longCap: [18, 22], longHours: 2.25, raceWeekFactor: 0.4,
    specific: { title: 'Lari pace HM (2x5 km)', notes: 'Jogging 3 menit di antaranya.' }, longRpMaxKm: 6, longReadyKm: 15,
  },
  {
    km: MARATHON_KM, label: 'Full Marathon (42K)', short: 'maraton', defaultTarget: '4:30:00', minWeeks: 10, peakFactor: 1,
    longCap: [24, 32], longHours: 3, raceWeekFactor: 0.3,
    specific: { title: 'Lari pace maraton', notes: 'Bagian tengah di pace maraton.' }, longRpMaxKm: 14, longReadyKm: 28,
  },
];

/** Konfigurasi untuk jarak lomba (dibulatkan ke kategori terdekat). */
export function distanceFor(km: number | null | undefined): DistanceConfig {
  const k = km || MARATHON_KM;
  return DISTANCES.reduce((a, b) => (Math.abs(b.km - k) < Math.abs(a.km - k) ? b : a));
}

export interface PlanInput {
  raceName: string;
  raceDate: string; // YYYY-MM-DD
  raceKm: number; // 5 | 10 | 21.0975 | 42.195
  targetSec: number; // target waktu di jarak lomba
  startDate: string; // tanggal mulai program (biasanya hari ini)
  /** Hari lari, 0 = Senin … 6 = Minggu (3-6 hari) */
  runDays: number[];
  /** Hari long run (harus salah satu runDays) */
  longDay: number;
  /** Sesi strength per minggu (0-3), otomatis ditaruh di hari tanpa lari */
  strengthPerWeek: number;
  currentWeeklyKm: number;
  peakWeeklyKm?: number;
  /** Perkiraan waktu MARATON (setara) dengan kemampuan sekarang, dari lomba/tes terbaru atau data Strava. */
  fitnessSec?: number;
  /** Mode push: pace dipercepat X% (0-15). Default hanya sesi kualitas (tempo, interval, pace lomba, tes). */
  pushPct?: number;
  /** true = easy, long, dan recovery ikut dipercepat */
  pushAll?: boolean;
}

export interface PlannedSession {
  date: string;
  week: number;
  phase: Phase;
  type: SessionType;
  title: string;
  distanceKm: number;
  paceSec: number | null;
  targetSec: number | null;
  notes: string;
}

export interface GeneratedPlan {
  totalWeeks: number;
  startMonday: string;
  peakWeeklyKm: number;
  weeklyKm: number[]; // rencana km per minggu (index 0 = minggu 1)
  phases: Phase[]; // fase per minggu
  sessions: PlannedSession[];
}

/** Rumus Riegel: prediksi waktu di jarak lain */
export function riegel(timeSec: number, fromKm: number, toKm: number) {
  return timeSec * Math.pow(toKm / fromKm, 1.06);
}

/** Volume puncak default (km/minggu) dari waktu maraton setara. */
export function defaultPeakKm(marathonEqSec: number): number {
  const h = marathonEqSec / 3600;
  if (h <= 3) return 85;
  if (h <= 3.5) return 72;
  if (h <= 4) return 62;
  if (h <= 4.5) return 55;
  if (h <= 5) return 48;
  return 42;
}

export function defaultPeakFor(raceKm: number, targetSec: number): number {
  const d = distanceFor(raceKm);
  return Math.round(defaultPeakKm(riegel(targetSec, d.km, MARATHON_KM)) * d.peakFactor);
}

const round05 = (x: number) => Math.max(0, Math.round(x * 2) / 2);
const round30s = (s: number) => Math.round(s / 30) * 30;

type Role = 'Q1' | 'Q2' | 'E' | 'L' | 'R';
/** Jarak antar hari dalam siklus mingguan (Minggu → Senin = 1 hari) */
const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));

/**
 * Tentukan peran tiap hari lari: L di hari long run, sesi kualitas (Q1, Q2) sejauh mungkin dari L dan satu sama lain,
 * recovery (kalau 6x) di hari setelah long run, sisanya easy. Hasil: [hari, peran][] urut Senin → Minggu.
 */
export function assignRoles(days: number[], longDay: number): [number, Role][] {
  const roles = new Map<number, Role>([[longDay, 'L']]);
  const hard = [longDay];
  const pickFar = () => {
    const free = days.filter((d) => !roles.has(d));
    // terjauh dari sesi berat; seri → hari lebih awal di minggu
    return free.sort((a, b) => Math.min(...hard.map((h) => gap(b, h))) - Math.min(...hard.map((h) => gap(a, h))) || a - b)[0];
  };
  const q1 = pickFar();
  roles.set(q1, 'Q1');
  hard.push(q1);
  if (days.length >= 4) {
    const q2 = pickFar();
    roles.set(q2, 'Q2');
    hard.push(q2);
  }
  if (days.length >= 6) {
    const after = (longDay + 1) % 7;
    const r = !roles.has(after) && days.includes(after) ? after : days.find((d) => !roles.has(d));
    if (r !== undefined) roles.set(r, 'R');
  }
  return [...days].sort((a, b) => a - b).map((d) => [d, roles.get(d) ?? 'E']);
}

/**
 * Pilih hari strength: utamakan hari tanpa lari, hindari H-1 long run / sesi kualitas dan hari setelah long run,
 * beri jarak ≥ 2 hari antar sesi strength. Kalau hari kosong tidak cukup, boleh di hari easy (setelah lari).
 */
export function strengthDays(roles: [number, Role][], n: number): number[] {
  if (n <= 0) return [];
  const role = new Map(roles);
  const score = (d: number) => {
    const r = role.get(d);
    if (r && r !== 'E' && r !== 'R') return -Infinity; // jangan di hari long/kualitas
    let s = r ? -4 : 0; // hari easy kurang disukai dibanding hari kosong
    const next = role.get((d + 1) % 7);
    if (next === 'L') s -= 10;
    else if (next === 'Q1' || next === 'Q2') s -= 5;
    if (role.get((d + 6) % 7) === 'L') s -= 3;
    return s;
  };
  const picked: number[] = [];
  for (let i = 0; i < n; i++) {
    // H-1 long run tidak pernah dipakai; lebih baik strength-nya berkurang daripada long run dengan kaki pegal
    const cands = [0, 1, 2, 3, 4, 5, 6].filter((d) => !picked.includes(d) && score(d) > -10);
    const spaced = cands.filter((d) => picked.every((p) => gap(d, p) >= 2));
    const pool = spaced.length ? spaced : cands;
    if (!pool.length) break;
    picked.push(pool.sort((a, b) => score(b) - score(a) || a - b)[0]);
  }
  return picked.sort((a, b) => a - b);
}

const STRENGTH = {
  A: {
    title: 'Strength A: kaki & core',
    notes: 'Squat 3x10 · Reverse lunge 3x8/kaki · Romanian deadlift 3x10 · Calf raise 3x15 · Plank 3x40 dtk. ±35 menit, sisakan 2 repetisi (jangan sampai gagal).',
  },
  B: {
    title: 'Strength B: stabilitas',
    notes: 'Step-up 3x10/kaki · Single-leg deadlift 3x8/kaki · Glute bridge 3x12 · Side plank 3x30 dtk/sisi · Dead bug 3x10. ±30 menit.',
  },
  maint: {
    title: 'Strength maintenance',
    notes: 'Squat 2x8 · Single-leg deadlift 2x8/kaki · Calf raise 2x15 · Plank 2x40 dtk. ±25 menit, beban sedang; jangan sampai pegal untuk sesi lari berikutnya.',
  },
  light: {
    title: 'Strength ringan (taper)',
    notes: 'Glute bridge 2x12 · Clamshell 2x15 · Plank 2x30 dtk · Calf raise 2x12. ±15 menit, tanpa beban berat.',
  },
};

export function validateInput(inp: PlanInput): string | null {
  const d = distanceFor(inp.raceKm);
  const weeks = Math.floor(diffDays(mondayOf(inp.startDate), mondayOf(inp.raceDate)) / 7) + 1;
  if (!inp.raceName.trim()) return 'Nama lomba wajib diisi.';
  if (weeks < d.minWeeks) return `Untuk ${d.label}, jarak ke hari lomba minimal ${d.minWeeks} minggu.`;
  if (weeks > 52) return 'Program maksimal 52 minggu. Pilih tanggal mulai yang lebih dekat.';
  const pace = inp.targetSec / d.km;
  if (pace < 150 || pace > 720) return `Target ${fmtDuration(inp.targetSec)} untuk ${d.label} = ${fmtPace(pace)}. Pace harus antara 2:30 dan 12:00 /km.`;
  if (inp.runDays.length < 3 || inp.runDays.length > 6) return 'Pilih 3-6 hari lari per minggu.';
  if (inp.runDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'Hari lari tidak valid.';
  if (!inp.runDays.includes(inp.longDay)) return 'Hari long run harus salah satu hari lari yang dipilih.';
  if (inp.strengthPerWeek < 0 || inp.strengthPerWeek > 3) return 'Strength training maksimal 3x per minggu.';
  if ((inp.pushPct ?? 0) < 0 || (inp.pushPct ?? 0) > 15) return 'Push harus antara 0% dan 15%.';
  if (inp.currentWeeklyKm < 0 || inp.currentWeeklyKm > 200) return 'Volume mingguan saat ini tidak valid.';
  return null;
}

export function generatePlan(inp: PlanInput): GeneratedPlan {
  const dist = distanceFor(inp.raceKm);
  const D = dist.km;
  const isFM = D === MARATHON_KM;
  const startMonday = mondayOf(inp.startDate);
  const raceMonday = mondayOf(inp.raceDate);
  const totalWeeks = Math.floor(diffDays(startMonday, raceMonday) / 7) + 1;

  // Semua pace latihan dihitung dari "pace maraton setara" (via Riegel), jadi satu rumus berlaku untuk semua jarak.
  const goalEqSec = riegel(inp.targetSec, D, MARATHON_KM);
  const goalMp = goalEqSec / MARATHON_KM;
  const peak = Math.max(inp.peakWeeklyKm || defaultPeakFor(D, inp.targetSec), 15);

  // ---- Pembagian fase ----
  const taperW = isFM ? (totalWeeks >= 16 ? 3 : 2) : D > 20 ? (totalWeeks >= 12 ? 2 : 1) : 1; // termasuk minggu lomba
  const rest = totalWeeks - taperW;
  const baseW = Math.max(1, Math.round(rest * 0.36));
  const buildW = Math.max(1, Math.round(rest * 0.32));
  const specW = Math.max(1, rest - baseW - buildW);
  const phases: Phase[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    phases.push(i < baseW ? 'Base' : i < baseW + buildW ? 'Build' : i < baseW + buildW + specW ? 'Spesifik' : 'Taper');
  }

  // ---- Pace: mulai dari kemampuan sekarang, naik bertahap ke target sampai akhir fase Build ----
  // Pace easy/long selalu relatif ke kemampuan minggu itu, bukan ke target akhir.
  const curMp = Math.max(goalMp, (inp.fitnessSec ?? goalEqSec) / MARATHON_KM);
  const rampWeeks = Math.max(1, baseW + buildW);
  // Peningkatan realistis maks ~0,8%/minggu: kalau target terlalu ambisius, latihan tetap di pace yang masuk akal
  // (hanya lomba yang memakai pace target).
  const mpAt = (w: number) =>
    Math.max(curMp + (goalMp - curMp) * Math.min(1, w / rampWeeks), curMp * (1 - 0.008 * w), goalMp);
  /** Pace lomba (di jarak D) sesuai kemampuan yang diharapkan di minggu w */
  const rpAt = (w: number) => riegel(mpAt(w) * MARATHON_KM, MARATHON_KM, D) / D;

  // ---- Volume per minggu: naik bertahap (maks +10% dan maks +5 km), minggu ke-4 turun (recovery) ----
  const start = Math.max(inp.currentWeeklyKm, Math.min(15, peak * 0.4));
  const weeklyKm: number[] = [];
  let last = start;
  for (let i = 0; i < rest; i++) {
    const linear = start + (peak - start) * (rest > 1 ? i / (rest - 1) : 1);
    const target = i === 0 ? start : Math.min(linear, last * 1.1, last + 5);
    const cutback = i % 4 === 3 && i < rest - 1;
    weeklyKm.push(round05(cutback ? target * 0.8 : target));
    if (!cutback) last = target;
  }
  const taperFactors = taperW === 3 ? [0.75, 0.55] : taperW === 2 ? [isFM ? 0.6 : 0.7] : [];
  const lastPeak = Math.max(...weeklyKm.slice(-3), start);
  taperFactors.forEach((f) => weeklyKm.push(round05(lastPeak * f)));
  weeklyKm.push(round05(lastPeak * dist.raceWeekFactor + D)); // minggu lomba (termasuk lomba)

  // ---- Checkpoint (tes) ----
  // Jarak tes: 5K untuk lomba 5K/10K, 10K untuk HM/FM. Tes HM tambahan hanya untuk FM.
  // Target tes mengikuti kemampuan yang diharapkan di minggu itu, bukan target akhir.
  // Mode push: pengali pace (lebih kecil = lebih cepat). Lomba sendiri tetap memakai target asli.
  const qBoost = 1 - Math.min(Math.max(inp.pushPct ?? 0, 0), 15) / 100;
  const eBoost = inp.pushAll ? qBoost : 1;
  const testKm = D <= 10 ? 5 : 10;
  const testAt = (w: number, km: number) => riegel(mpAt(w) * MARATHON_KM, MARATHON_KM, km) * qBoost;
  const tests = new Map<number, { km: number; sec: number; title: string }>();
  if (baseW >= 3) tests.set(baseW - 1, { km: testKm, sec: round30s(testAt(baseW - 1, testKm) * 1.03), title: `Tes ${testKm}K` });
  if (buildW >= 2) tests.set(baseW + buildW - 1, { km: testKm, sec: round30s(testAt(baseW + buildW - 1, testKm) * 1.01), title: `Tes ${testKm}K` });
  if (isFM) {
    const hmWeek = Math.max(baseW + buildW, totalWeeks - 10);
    // Tes HM hanya kalau volume sudah cukup; 21 km dengan long run 8 km = cari cedera
    if (hmWeek < totalWeeks - taperW && weeklyKm[hmWeek] >= 35) tests.set(hmWeek, { km: 21.1, sec: round30s(testAt(hmWeek, 21.0975)), title: 'Tes HM' });
  }

  // ---- Susun sesi harian ----
  const sessions: PlannedSession[] = [];
  const paceFor = (mp: number) => ({
    easy: (mp + 75) * eBoost,
    recovery: (mp + 100) * eBoost,
    long: (mp + 50) * eBoost,
    tempo: (mp - 20) * qBoost,
    interval: (mp - 40) * qBoost,
  });
  const push = (s: Omit<PlannedSession, 'notes'> & { notes?: string }) => {
    if (s.date < inp.startDate || s.date > inp.raceDate) return;
    if (s.type !== 'race' && s.date >= addDays(inp.raceDate, -1)) return; // H-1 dan hari lomba hanya lomba
    if (s.type === 'strength' && s.date >= addDays(inp.raceDate, -3)) return; // strength stop 3 hari sebelum lomba
    sessions.push({ notes: '', ...s, paceSec: s.paceSec == null ? null : Math.round(s.paceSec) });
  };

  const pattern = assignRoles(inp.runDays, inp.longDay);
  const sDays = strengthDays(pattern, inp.strengthPerWeek);
  const nRuns = inp.runDays.length;

  for (let w = 0; w < totalWeeks; w++) {
    const monday = addDays(startMonday, w * 7);
    const phase = phases[w];
    const km = weeklyKm[w];
    const week = w + 1;
    const pace = paceFor(mpAt(w));
    const rp = rpAt(w) * qBoost;

    // Minggu lomba: lari ringan di hari lari pilihan user (sebelum H-1) + lomba (pace lomba = target)
    if (w === totalWeeks - 1) {
      const goalRp = inp.targetSec / D;
      const easyKm = D >= 21 ? 6 : 5;
      const slots = inp.runDays.map((d) => addDays(monday, d)).filter((d) => d < addDays(inp.raceDate, -1)).sort();
      const plan: Omit<PlannedSession, 'date' | 'notes' | 'week' | 'phase'>[] = [
        { type: 'easy', title: 'Easy + 4x strides', distanceKm: easyKm, paceSec: pace.easy, targetSec: null },
        { type: 'mp', title: `Easy + ${D >= 21 ? 3 : 2} km pace ${dist.short}`, distanceKm: easyKm, paceSec: goalRp, targetSec: null },
      ];
      if (nRuns >= 5) plan.push({ type: 'recovery', title: 'Shakeout', distanceKm: 3, paceSec: pace.recovery, targetSec: null });
      const notes: Record<string, string> = { easy: 'Strides 20 detik, santai.', mp: 'Rasakan pace lomba, jangan lebih cepat.' };
      // ambil hari-hari terakhir sebelum lomba supaya sesinya dekat ke hari H
      slots.slice(-plan.length).forEach((date, i) => {
        const p = plan[plan.length - Math.min(plan.length, slots.length) + i];
        push({ ...p, date, week, phase, notes: notes[p.type] });
      });
      push({ date: inp.raceDate, week, phase, type: 'race', title: inp.raceName, distanceKm: D, paceSec: goalRp, targetSec: inp.targetSec, notes: `Target ${fmtDuration(inp.targetSec)} (${fmtPace(goalRp)}).` });
      continue;
    }

    // Strength: Base = 2 variasi bergantian (A/B), Build/Spesifik = maintenance maks 2x, Taper = 1x ringan
    const nStrength = phase === 'Base' ? sDays.length : phase === 'Taper' ? Math.min(1, sDays.length) : Math.min(2, sDays.length);
    sDays.slice(0, nStrength).forEach((d, i) => {
      const s = phase === 'Base' ? (i % 2 === 0 ? STRENGTH.A : STRENGTH.B) : phase === 'Taper' ? STRENGTH.light : STRENGTH.maint;
      const onRunDay = inp.runDays.includes(d);
      push({ date: addDays(monday, d), week, phase, type: 'strength', title: s.title, distanceKm: 0, paceSec: null, targetSec: null,
        notes: (onRunDay ? 'Setelah easy run (atau beberapa jam setelahnya). ' : '') + s.notes });
    });

    const test = tests.get(w);
    // Long run dibatasi jarak DAN waktu, supaya pelari yang lebih lambat tidak lari terlalu lama.
    const longCap = Math.min(dist.longCap[phase === 'Base' ? 0 : 1], Math.floor((dist.longHours * 3600) / pace.long));
    let longKm = Math.min(Math.max(km * 0.32, 6), longCap);
    if (phase === 'Taper') longKm = Math.min(longKm, km * 0.4);
    const q1Km = Math.max(km * 0.18, 4);
    const q2Km = Math.max(km * 0.15, 4);
    const nEasy = pattern.filter(([, k]) => k === 'E' || k === 'R').length;
    const used = (test ? test.km + 4 : longKm) + q1Km + (pattern.some(([, k]) => k === 'Q2') ? q2Km : 0);
    let easyKm = nEasy ? Math.max((km - used) / nEasy, 3) : 0;
    // Easy run tidak boleh lebih panjang dari ~70% long run: pindahkan kelebihannya ke long run
    if (!test && phase !== 'Taper' && nEasy && easyKm > longKm * 0.7) {
      const pool = longKm + easyKm * nEasy;
      longKm = Math.min(longCap, pool / (1 + 0.7 * nEasy));
      easyKm = Math.max((pool - longKm) / nEasy, 3);
    }
    // Paruh pertama Base: belum ada tempo, cukup easy + strides
    const earlyBase = phase === 'Base' && w < Math.ceil(baseW / 2);

    for (const [day, kind] of pattern) {
      const date = addDays(monday, day);
      if (kind === 'L') {
        if (test) {
          push({ date, week, phase, type: 'test', title: test.title, distanceKm: test.km, paceSec: test.sec / test.km, targetSec: test.sec, notes: `Target ≤ ${fmtDuration(test.sec)}. Pemanasan 2 km + pendinginan 2 km.` });
        } else if (phase === 'Spesifik' && w % 2 === 0 && dist.longRpMaxKm > 0) {
          const rpKm = Math.round(Math.min(longKm * 0.4, dist.longRpMaxKm));
          push({ date, week, phase, type: 'long', title: `Long run + ${rpKm} km pace ${dist.short}`, distanceKm: round05(longKm), paceSec: pace.long, targetSec: null, notes: `${rpKm} km terakhir di ${fmtPace(rp)}.` });
        } else {
          push({ date, week, phase, type: 'long', title: 'Long run', distanceKm: round05(longKm), paceSec: pace.long, targetSec: null, notes: 'Santai, bisa ngobrol.' });
        }
      } else if (kind === 'Q1') {
        if (earlyBase) push({ date, week, phase, type: 'easy', title: 'Easy + strides', distanceKm: round05(q1Km), paceSec: pace.easy, targetSec: null, notes: '6x20 detik strides di akhir, bukan sprint.' });
        else if (phase === 'Base') push({ date, week, phase, type: 'tempo', title: 'Tempo ringan', distanceKm: round05(q1Km), paceSec: pace.tempo + 10, targetSec: null, notes: 'Pemanasan 2 km, tempo 15-20 menit, pendinginan.' });
        else if (phase === 'Build') push({ date, week, phase, type: 'interval', title: 'Interval 5-6x1 km', distanceKm: round05(q1Km), paceSec: pace.interval, targetSec: null, notes: 'Jogging 2 menit antar repetisi.' });
        else if (phase === 'Spesifik') push({ date, week, phase, type: 'mp', title: dist.specific.title, distanceKm: round05(q1Km + 2), paceSec: rp, targetSec: null, notes: dist.specific.notes });
        else push({ date, week, phase, type: 'mp', title: `Pace ${dist.short} singkat`, distanceKm: round05(q1Km), paceSec: rp, targetSec: null });
      } else if (kind === 'Q2') {
        if (phase === 'Build' || phase === 'Spesifik') push({ date, week, phase, type: 'tempo', title: 'Tempo', distanceKm: round05(q2Km), paceSec: pace.tempo, targetSec: null, notes: 'Tempo 20-30 menit.' });
        else push({ date, week, phase, type: 'easy', title: 'Easy + strides', distanceKm: round05(q2Km), paceSec: pace.easy, targetSec: null, notes: '6x20 detik strides di akhir.' });
      } else if (kind === 'R') {
        push({ date, week, phase, type: 'recovery', title: 'Recovery run', distanceKm: round05(Math.min(easyKm, 8)), paceSec: pace.recovery, targetSec: null });
      } else {
        push({ date, week, phase, type: 'easy', title: 'Easy run', distanceKm: round05(easyKm), paceSec: pace.easy, targetSec: null });
      }
    }
  }

  // urut per tanggal; di hari yang sama lari dulu baru strength
  sessions.sort((a, b) => a.date.localeCompare(b.date) || Number(a.type === 'strength') - Number(b.type === 'strength'));
  return { totalWeeks, startMonday, peakWeeklyKm: peak, weeklyKm, phases, sessions };
}
