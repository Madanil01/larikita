import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, type User } from './db';

const COOKIE = 'lk_session';

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET minimal 32 karakter');
  return new TextEncoder().encode(s);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400,
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function getUserId(): Promise<number | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === 'number' ? payload.uid : null;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const rows = await db()<User[]>`select * from users where id = ${uid}`;
  return rows[0] ?? null;
}

/** Untuk halaman: tendang ke beranda kalau belum login */
export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect('/');
  return u;
}
