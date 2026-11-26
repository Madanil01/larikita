'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { MAX_PLANS, db } from '@/lib/db';
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
  // plan_id diisi = ubah rencana itu; kosong = rencana baru (rencana lain tetap jalan)
  const planId = /^\d+$/.test(str('plan_id')) ? Number(str('plan_id')) : null;
  const fail = (m: string) => redirect(`/rencana?${planId ? `id=${planId}` : 'baru=1'}&error=${encodeURIComponent(m)}`);
  if (planId) {
    const own = await db()`select 1 from plans where id = ${planId} and user_id = ${user.id}`;
    if (!own.length) redirect('/rencana?error=' + encodeURIComponent('Rencana tidak ditemukan.'));
  } else {
    const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from plans where user_id = ${user.id}`;
    if (n >= MAX_PLANS) redirect('/rencana?error=' + encodeURIComponent(`Maksimal ${MAX_PLANS} rencana. Hapus rencana lama dulu.`));
  }
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
  const row = {
    user_id: user.id, race_name: input.raceName, race_date: input.raceDate, race_km: dist.km,
    goal_title: str('goal_title') || null, target_sec: targetSec, start_date: input.startDate,
    runs_per_week: runDays.length, run_days: runDays.join(','), long_day: input.longDay,
    strength_per_week: input.strengthPerWeek, push_pct: input.pushPct ?? 0, push_all: input.pushAll ?? false,
    current_weekly_km: input.currentWeeklyKm, peak_weekly_km: g.peakWeeklyKm, total_weeks: g.totalWeeks,
  };
  let id = planId;
  await db().begin(async (tx) => {
    await tx`update users set timezone = ${tz} where id = ${user.id}`;
    if (planId) {
      // ubah: data rencana diperbarui, sesinya dibuat ulang; id tetap sama supaya link ?plan= tidak putus
      await tx`update plans set ${tx(row)} where id = ${planId} and user_id = ${user.id}`;
      await tx`delete from sessions where plan_id = ${planId}`;
    } else {
      const [p] = await tx<{ id: number }[]>`insert into plans ${tx(row)} returning id`;
      id = p.id;
    }
    const rows = g.sessions.map((s) => ({
      plan_id: id, date: s.date, week: s.week, phase: s.phase, type: s.type, title: s.title,
      distance_km: s.distanceKm, pace_sec: s.paceSec, target_sec: s.targetSec, notes: s.notes || null,
    }));
    await tx`insert into sessions ${tx(rows)}`;
  });
  redirect(`/dashboard?plan=${id}`);
}

export async function deletePlan(form: FormData) {
  const user = await getUser();
  if (!user) redirect('/');
  const id = String(form.get('id') ?? '');
  if (/^\d+$/.test(id)) await db()`delete from plans where id = ${Number(id)} and user_id = ${user.id}`; // sesi ikut terhapus (cascade)
  revalidatePath('/dashboard');
  revalidatePath('/jadwal');
  redirect('/rencana');
}
