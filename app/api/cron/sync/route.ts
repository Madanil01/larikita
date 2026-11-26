import { NextRequest, NextResponse } from 'next/server';
import { db, type User } from '@/lib/db';
import { syncUser } from '@/lib/strava';

export const maxDuration = 60;

// Cadangan harian kalau webhook terlewat. Vercel mengirim header Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const users = await db()<User[]>`
    select * from users where access_token is not null
      and (last_sync_at is null or last_sync_at < now() - interval '12 hours')
    order by last_sync_at nulls first limit 40`;
  let ok = 0;
  for (const u of users) {
    try {
      await syncUser(u);
      ok++;
    } catch (e) {
      console.error('cron sync', u.id, (e as Error).message);
      if ((e as Error).message.includes('Batas request')) break;
    }
  }
  return NextResponse.json({ synced: ok, of: users.length });
}
