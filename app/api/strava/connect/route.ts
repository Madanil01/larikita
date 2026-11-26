import { NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { appUrl, authorizeUrl, stravaCreds } from '@/lib/strava';

export const dynamic = 'force-dynamic';

// Mulai OAuth Strava untuk akun yang sedang login, memakai aplikasi Strava milik user (atau default dari env).
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/`);
  const creds = stravaCreds(user);
  if (!creds) {
    return NextResponse.redirect(`${appUrl()}/pengaturan?error=${encodeURIComponent('Isi Client ID dan Client Secret Strava dulu.')}`);
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(creds, state));
  res.cookies.set('lk_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  return res;
}
