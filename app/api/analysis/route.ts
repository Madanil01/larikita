import { NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { db, getPlan, getRuns, getSessions, getStrength } from '@/lib/db';
import { syncUser } from '@/lib/strava';
import { addDays, todayIn } from '@/lib/dates';
import { matchSessions } from '@/lib/stats';
import { buildAnalysis } from '@/lib/analysis';

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  const plan = await getPlan(user.id);
  if (!plan) return NextResponse.json({ error: 'Buat rencana dulu.' }, { status: 400 });
  try {
    await syncUser(user); // pastikan data hari ini sudah masuk
  } catch {}
  const today = todayIn(user.timezone);
  const sessions = await getSessions(plan.id);
  const runs = await getRuns(user.id, addDays(today, -400), today);
  const body = buildAnalysis(today, matchSessions(sessions, runs, today, await getStrength(user.id, addDays(today, -14), today)), runs, plan.start_date);
  await db()`insert into analyses (user_id, date, body) values (${user.id}, ${today}, ${body})
             on conflict (user_id, date) do update set body = excluded.body, created_at = now()`;
  return NextResponse.json({ body });
}
