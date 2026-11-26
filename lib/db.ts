import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __sql?: Sql };

function create(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum di-set');
  return postgres(url, {
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
    max: 1, // serverless: 1 koneksi per instance
    idle_timeout: 20,
    prepare: false,
    onnotice: () => {},
    // kolom DATE dikembalikan apa adanya sebagai 'YYYY-MM-DD'
    types: {
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });
}

export function db(): Sql {
  if (!g.__sql) g.__sql = create();
  return g.__sql;
}

export interface User {
  id: number;
  email: string | null;
  password_hash: string | null;
  name: string;
  avatar: string | null;
  timezone: string;
  strava_client_id: string | null;
  strava_client_secret: string | null; // terenkripsi, lihat lib/crypto.ts
  strava_webhook_id: string | null;
  strava_id: string | null; // null = Strava belum tersambung
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  last_sync_at: Date | null;
  created_at: Date | null;
}

export interface Plan {
  id: number;
  user_id: number;
  race_name: string;
  race_date: string;
  race_km: number;
  run_days: string | null; // "1,3,6" (0 = Senin); null = rencana lama, pakai DEFAULT_DAYS
  long_day: number | null;
  strength_per_week: number;
  push_pct: number;
  push_all: boolean;
  goal_title: string | null;
  target_sec: number;
  start_date: string;
  runs_per_week: number;
  current_weekly_km: number;
  peak_weekly_km: number;
  total_weeks: number;
}

export interface SessionRow {
  id: number;
  plan_id: number;
  date: string;
  week: number;
  phase: string;
  type: string;
  title: string;
  distance_km: number;
  pace_sec: number | null;
  target_sec: number | null;
  notes: string | null;
}

export interface Activity {
  id: string;
  name: string | null;
  sport_type: string;
  local_date: string;
  distance_m: number;
  moving_time_s: number;
  avg_hr: number | null;
}

export const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

/** Maksimal rencana per user */
export const MAX_PLANS = 5;

/** Semua rencana user, urut tanggal lomba */
export async function getPlans(userId: number): Promise<Plan[]> {
  return db()<Plan[]>`select * from plans where user_id = ${userId} order by race_date, id`;
}

/** Rencana yang belum lewat (lomba hari ini atau nanti) */
export const activePlans = (plans: Plan[], today: string) => plans.filter((p) => p.race_date >= today);

/**
 * Rencana yang sedang dilihat: sesuai ?plan=ID kalau ada, kalau tidak lomba terdekat yang belum lewat,
 * kalau semuanya sudah lewat, yang paling akhir.
 */
export function pickPlan(plans: Plan[], today: string, id?: string | number | null): Plan | null {
  if (id) {
    const p = plans.find((x) => String(x.id) === String(id));
    if (p) return p;
  }
  return activePlans(plans, today)[0] ?? plans[plans.length - 1] ?? null;
}

export async function getSessions(planId: number): Promise<SessionRow[]> {
  return db()<SessionRow[]>`select * from sessions where plan_id = ${planId} order by date, id`;
}

export async function getRuns(userId: number, from: string, to: string): Promise<Activity[]> {
  return db()<Activity[]>`
    select id::text, name, sport_type, local_date, distance_m, moving_time_s, avg_hr
    from activities
    where user_id = ${userId} and local_date between ${from} and ${to}
      and sport_type in ${db()(RUN_TYPES)}
    order by local_date, start_date`;
}

/** Tipe aktivitas Strava yang dihitung sebagai sesi strength */
export const STRENGTH_TYPES = ['WeightTraining', 'Workout', 'Crossfit', 'HighIntensityIntervalTraining', 'Pilates', 'Yoga'];

export async function getStrength(userId: number, from: string, to: string): Promise<Activity[]> {
  return db()<Activity[]>`
    select id::text, name, sport_type, local_date, distance_m, moving_time_s, avg_hr
    from activities
    where user_id = ${userId} and local_date between ${from} and ${to}
      and sport_type in ${db()(STRENGTH_TYPES)}
    order by local_date, start_date`;
}

export interface ManualActivity {
  id: string;
  name: string | null;
  sport_type: string;
  local_date: string;
  distance_m: number;
  moving_time_s: number;
  avg_hr: number | null;
}

/** Aktivitas yang dicatat manual (bukan dari Strava) */
export async function getManual(userId: number, from: string, to: string): Promise<ManualActivity[]> {
  return db()<ManualActivity[]>`
    select id::text, name, sport_type, local_date, distance_m, moving_time_s, avg_hr
    from activities
    where user_id = ${userId} and manual and local_date between ${from} and ${to}
    order by local_date, id desc`;
}
