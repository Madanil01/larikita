'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { requireUser } from '@/lib/session';
import { disconnectStrava, ensureWebhook, stravaCreds } from '@/lib/strava';

const go = (key: 'ok' | 'error', msg: string): never => redirect(`/pengaturan?${key}=${encodeURIComponent(msg)}`);

export async function saveStravaApp(f: FormData) {
  const user = await requireUser();
  const clientId = String(f.get('client_id') ?? '').trim();
  const secret = String(f.get('client_secret') ?? '').trim();
  if (!/^\d{1,12}$/.test(clientId)) go('error', 'Client ID harus berupa angka.');
  if (!secret && !user.strava_client_secret) go('error', 'Client Secret wajib diisi.');
  if (secret && !/^[0-9a-f]{20,80}$/i.test(secret)) go('error', 'Format Client Secret tidak valid.');

  const changedApp = user.strava_client_id !== clientId;
  const wasConnected = !!user.access_token;
  // Token Strava terikat ke aplikasi; ganti aplikasi = harus hubungkan ulang.
  if (changedApp && wasConnected) await disconnectStrava(user);
  await db()`update users set strava_client_id = ${clientId},
               strava_client_secret = ${secret ? encrypt(secret) : user.strava_client_secret},
               strava_webhook_id = ${changedApp ? null : user.strava_webhook_id}
             where id = ${user.id}`;
  revalidatePath('/', 'layout');
  go('ok', changedApp && wasConnected ? 'Aplikasi Strava diganti. Hubungkan ulang Strava.' : 'Aplikasi Strava disimpan.');
}

export async function removeStravaApp() {
  const user = await requireUser();
  if (user.access_token) await disconnectStrava(user);
  await db()`update users set strava_client_id = null, strava_client_secret = null, strava_webhook_id = null
             where id = ${user.id}`;
  revalidatePath('/', 'layout');
  go('ok', 'Aplikasi Strava pribadi dihapus.');
}

export async function disconnect() {
  const user = await requireUser();
  await disconnectStrava(user);
  revalidatePath('/', 'layout');
  go('ok', 'Strava diputus dan data aktivitas dihapus.');
}

export async function enableWebhook() {
  const user = await requireUser();
  const creds = stravaCreds(user);
  if (!creds || !creds.own) return go('error', 'Webhook hanya bisa diatur untuk aplikasi Strava milikmu sendiri.');
  let id: number;
  try {
    id = await ensureWebhook(creds);
  } catch (e) {
    return go('error', (e as Error).message);
  }
  await db()`update users set strava_webhook_id = ${id} where id = ${user.id}`;
  go('ok', 'Webhook aktif. Lari baru akan masuk otomatis.');
}
