import { NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { syncUser, StravaError } from '@/lib/strava';

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  try {
    const n = await syncUser(user);
    return NextResponse.json({ ok: true, count: n });
  } catch (e) {
    const status = e instanceof StravaError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
