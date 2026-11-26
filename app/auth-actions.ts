'use server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { createSession } from '@/lib/session';

const fail = (mode: 'masuk' | 'daftar', msg: string): never =>
  redirect(`/?mode=${mode}&error=${encodeURIComponent(msg)}`);

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function register(f: FormData) {
  const name = str(f, 'name').slice(0, 80);
  const email = str(f, 'email').toLowerCase();
  const password = String(f.get('password') ?? '');
  if (!name) fail('daftar', 'Nama wajib diisi.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('daftar', 'Format email tidak valid.');
  if (password.length < 8) fail('daftar', 'Password minimal 8 karakter.');

  const exists = await db()`select 1 from users where lower(email) = ${email}`;
  if (exists.length) fail('daftar', 'Email sudah terdaftar. Silakan masuk.');

  const hash = await hashPassword(password);
  const rows = await db()<{ id: number }[]>`
    insert into users (email, password_hash, name, timezone)
    values (${email}, ${hash}, ${name}, ${process.env.DEFAULT_TZ || 'Asia/Jakarta'})
    returning id`;
  await createSession(rows[0].id);
  redirect('/pengaturan');
}

export async function login(f: FormData) {
  const email = str(f, 'email').toLowerCase();
  const password = String(f.get('password') ?? '');
  const rows = await db()<{ id: number; password_hash: string | null }[]>`
    select id, password_hash from users where lower(email) = ${email}`;
  const ok = await verifyPassword(password, rows[0]?.password_hash ?? null);
  if (!ok) fail('masuk', 'Email atau password salah.');
  await createSession(rows[0].id);
  redirect('/dashboard');
}
