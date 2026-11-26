'use server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getUser } from '@/lib/session';
import { distanceFor, generatePlan, validateInput, type PlanInput } from '@/lib/plan';
import { parseDuration, todayIn } from '@/lib/dates';
import { estimateFromStrava, predictMarathon } from '@/lib/fitness';

/** Waktu lomba pendek: "mm:dd" atau "j:mm:dd" */
function parseShortTime(s: string): number | null {
  const p = s.split(':').map(Number);
  if (!s || p.some((x) => !isFinite(x) || x < 0)) return null;
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return null;
}

export async function savePlan(form: FormData) {
  const user = await getUser();
  if (!user) redirect('/');
  const str = (k: string) => String(form.get(k) ?? '').trim();
  const fail = (m: string) => redirect(`/rencana?error=${encodeURIComponent(m)}`);
  const dist = distanceFor(Number(str('race_km')));
  // 5K/10K: "mm:dd" dibaca menit:detik. HM/FM: "j:mm" dibaca jam:menit. "j:mm:dd" selalu jam:menit:detik.
  const targetSec = dist.km <= 10 ? parseShortTime(str('target')) : parseDuration(str('target'));
  if (!targetSec) return fail(`Format target waktu salah. Contoh: ${dist.defaultTarget}`);

  const tz = str('timezone') || user.timezone;

  // Kemampuan sekarang: dari hasil lomba/tes terbaru kalau diisi, kalau tidak dari data Strava.
  let fitnessSec: number | undefined;
  const recentKm = Number(str('recent_km'));
  const recentSec = parseShortTime(str('recent_time'));
  if (str('recent_time')) {
    if (!recentKm || !recentSec) return fail('Format waktu lomba terbaru salah. Contoh: 28:30 atau 1:02:00');
    fitnessSec = Math.round(predictMarathon(recentSec, recentKm));
  } else {
    fitnessSec = (await estimateFromStrava(user.id, todayIn(tz)))?.sec;
  }

  const runDays = [...new Set(form.getAll('run_days').map(Number))].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);

  const input: PlanInput = {
    raceName: str('race_name'),
    raceDate: str('race_date'),
    raceKm: dist.km,
    targetSec,
    startDate: str('start_date') || todayIn(tz),
    runDays,
    longDay: Number(str('long_day')),
    strengthPerWeek: Number(str('strength')) || 0,
    pushPct: Math.round(Number(str('push_pct')) || 0),
    pushAll: str('push_all') === 'on',
    currentWeeklyKm: Number(str('current_km')) || 0,
    peakWeeklyKm: Number(str('peak_km')) || undefined,
    fitnessSec,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.raceDate)) return fail('Tanggal lomba wajib diisi.');
  const err = validateInput(input);
  if (err) return fail(err);

  const g = generatePlan(input);
  await db().begin(async (tx) => {
    await tx`update users set timezone = ${tz} where id = ${user.id}`;
    await tx`delete from plans where user_id = ${user.id}`;
    const [p] = await tx<{ id: number }[]>`
      insert into plans (user_id, race_name, race_date, race_km, goal_title, target_sec, start_date, runs_per_week,
                         run_days, long_day, strength_per_week, push_pct, push_all,
                         current_weekly_km, peak_weekly_km, total_weeks)
      values (${user.id}, ${input.raceName}, ${input.raceDate}, ${dist.km}, ${str('goal_title') || null}, ${targetSec},
              ${input.startDate}, ${runDays.length}, ${runDays.join(',')}, ${input.longDay}, ${input.strengthPerWeek},
              ${input.pushPct ?? 0}, ${input.pushAll ?? false},
              ${input.currentWeeklyKm}, ${g.peakWeeklyKm}, ${g.totalWeeks})
      returning id`;
    const rows = g.sessions.map((s) => ({
      plan_id: p.id, date: s.date, week: s.week, phase: s.phase, type: s.type, title: s.title,
      distance_km: s.distanceKm, pace_sec: s.paceSec, target_sec: s.targetSec, notes: s.notes || null,
    }));
    await tx`insert into sessions ${tx(rows)}`;
  });
  redirect('/dashboard');
}
