import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db, type User } from '@/lib/db';
import { appUrl, exchangeCode, stravaCreds, syncUser } from '@/lib/strava';
import { getUser } from '@/lib/session';

const back = (err: string) => NextResponse.redirect(`${appUrl()}/pengaturan?error=${encodeURIComponent(err)}`);

// Strava mengarahkan balik ke sini setelah user memberi izin. Token disimpan ke akun yang sedang login.
export async function GET(req: NextRequest) {
  const me = await getUser();
  if (!me) return NextResponse.redirect(`${appUrl()}/?error=${encodeURIComponent('Masuk dulu sebelum menghubungkan Strava.')}`);

  const q = req.nextUrl.searchParams;
  if (q.get('error')) return back('Izin Strava dibatalkan.');
  const state = cookies().get('lk_state')?.value;
  if (!state || state !== q.get('state')) return back('Sesi koneksi kedaluwarsa, coba lagi.');
  const scope = q.get('scope') || '';
  if (!scope.includes('activity:read')) return back('Centang izin "lihat aktivitas" supaya data lari bisa disinkronkan.');
  const code = q.get('code');
  if (!code) return back('Kode otorisasi tidak ada.');
  const creds = stravaCreds(me);
  if (!creds) return back('Aplikasi Strava belum diatur.');

  let t;
  try {
    t = await exchangeCode(creds, code);
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes('403') || msg.toLowerCase().includes('limit')) {
      return back(
        creds.own
          ? 'Strava menolak: kuota atlet aplikasi Strava-mu penuh. Pastikan aplikasi itu dibuat dengan akun Strava yang sama dengan yang kamu hubungkan.'
          : 'Kuota atlet aplikasi Strava bersama sudah penuh. Pakai aplikasi Strava milikmu sendiri di bawah.',
      );
    }
    console.error(e);
    return back('Gagal menghubungkan Strava. Cek Client ID / Secret.');
  }
  const a = t.athlete!;

  const taken = await db()`select id from users where strava_id = ${a.id} and id <> ${me.id}`;
  if (taken.length) return back('Akun Strava ini sudah terhubung ke akun LariKita lain.');

  const rows = await db()<User[]>`
    update users set strava_id = ${a.id}, avatar = coalesce(${a.profile_medium || a.profile || null}, avatar),
      access_token = ${t.access_token}, refresh_token = ${t.refresh_token}, expires_at = ${t.expires_at}
    where id = ${me.id}
    returning *`;
  const user = rows[0];
  try {
    await syncUser(user);
  } catch (e) {
    console.error('sync awal gagal', e);
  }
  cookies().delete('lk_state');
  const plan = await db()`select 1 from plans where user_id = ${user.id}`;
  return NextResponse.redirect(`${appUrl()}${plan.length ? '/dashboard' : '/rencana'}`);
}
