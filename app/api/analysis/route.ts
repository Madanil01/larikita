import { NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { activePlans, db, getPlans, getRuns, getSessions, getStrength } from '@/lib/db';
import { syncUser } from '@/lib/strava';
import { addDays, todayIn } from '@/lib/dates';
import { matchSessions } from '@/lib/stats';
import { buildAnalysis } from '@/lib/analysis';

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  const today = todayIn(user.timezone);
  const all = await getPlans(user.id);
  if (!all.length) return NextResponse.json({ error: 'Buat rencana dulu.' }, { status: 400 });
  // Semua rencana yang belum lewat; kalau semuanya sudah lewat, rencana terakhir saja
  const plans = activePlans(all, today).length ? activePlans(all, today) : [all[all.length - 1]];
  try {
    await syncUser(user); // pastikan data hari ini sudah masuk
  } catch {}
  const runs = await getRuns(user.id, addDays(today, -400), today);
  const strength = await getStrength(user.id, addDays(today, -14), today);
  const parts: string[] = [];
  for (const plan of plans) {
    const sessions = await getSessions(plan.id);
    const text = buildAnalysis(today, matchSessions(sessions, runs, today, strength), runs, plan.start_date);
    // lebih dari satu rencana: tiap bagian diberi judul ("## " dirender sebagai subjudul di AnalysisCard)
    parts.push(plans.length > 1 ? `## ${plan.race_name}\n${text}` : text);
  }
  const body = parts.join('\n');
  await db()`insert into analyses (user_id, date, body) values (${user.id}, ${today}, ${body})
             on conflict (user_id, date) do update set body = excluded.body, created_at = now()`;
  return NextResponse.json({ body });
}
