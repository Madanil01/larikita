import { NextRequest, NextResponse } from 'next/server';
import { db, type User } from '@/lib/db';
import { disconnectStrava, syncOneActivity } from '@/lib/strava';

// Verifikasi langganan webhook (dipanggil Strava sekali saat subscribe).
// Satu URL ini dipakai bersama oleh semua aplikasi Strava (milik user maupun default dari env).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': q.get('hub.challenge') });
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

interface Event {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id?: number;
  updates?: Record<string, string>;
}

// Event aktivitas baru/ubah/hapus. Harus balas < 2 detik, jadi kerja ringan saja.
export async function POST(req: NextRequest) {
  const ev = (await req.json()) as Event;
  const rows = await db()<User[]>`select * from users where strava_id = ${ev.owner_id}`;
  const user = rows[0];
  if (!user) return NextResponse.json({ ok: true });
  // Untuk aplikasi Strava milik user: abaikan event dari langganan yang bukan miliknya
  if (user.strava_webhook_id && ev.subscription_id && String(ev.subscription_id) !== String(user.strava_webhook_id)) {
    return NextResponse.json({ ok: true });
  }
  try {
    if (ev.object_type === 'athlete' && ev.updates?.authorized === 'false') {
      // user mencabut akses dari Strava: putuskan koneksi & hapus data aktivitasnya (akun tetap ada)
      await disconnectStrava(user, false);
    } else if (ev.object_type === 'activity') {
      if (ev.aspect_type === 'delete') await db()`delete from activities where id = ${ev.object_id} and user_id = ${user.id}`;
      else await syncOneActivity(user, ev.object_id);
    }
  } catch (e) {
    console.error('webhook', e);
  }
  return NextResponse.json({ ok: true });
}
