import { db, type User } from './db';
import { decrypt } from './crypto';

const API = (process.env.STRAVA_API_BASE || 'https://www.strava.com/api/v3').replace(/\/$/, '');
const OAUTH = 'https://www.strava.com/oauth';
export const STRAVA_SCOPE = 'read,activity:read_all';

export function appUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export const webhookUrl = () => `${appUrl()}/api/strava/webhook`;

export class StravaError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

export interface StravaCreds {
  clientId: string;
  clientSecret: string;
  /** true = aplikasi Strava milik user sendiri, false = aplikasi bersama dari env */
  own: boolean;
}

/** Aplikasi Strava yang dipakai user: miliknya sendiri kalau diisi, kalau tidak pakai env (kalau ada). */
export function stravaCreds(user: Pick<User, 'strava_client_id' | 'strava_client_secret'>): StravaCreds | null {
  if (user.strava_client_id && user.strava_client_secret) {
    try {
      return { clientId: user.strava_client_id, clientSecret: decrypt(user.strava_client_secret), own: true };
    } catch {
      return null; // kunci enkripsi berubah: user perlu isi ulang secret
    }
  }
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  return id && secret ? { clientId: id, clientSecret: secret, own: false } : null;
}

function mustCreds(user: User): StravaCreds {
  const c = stravaCreds(user);
  if (!c) throw new StravaError(400, 'Aplikasi Strava belum diatur. Buka Pengaturan.');
  return c;
}

export function authorizeUrl(creds: StravaCreds, state: string) {
  const p = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: `${appUrl()}/api/auth/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${p}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string; profile_medium?: string; profile?: string };
}

async function tokenRequest(creds: StravaCreds, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret, ...body }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Strava token error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (creds: StravaCreds, code: string) =>
  tokenRequest(creds, { code, grant_type: 'authorization_code' });

/** Access token Strava berlaku 6 jam; refresh otomatis kalau hampir habis. */
export async function accessToken(user: User): Promise<string> {
  if (!user.access_token || !user.refresh_token || !user.expires_at) {
    throw new StravaError(400, 'Strava belum tersambung. Buka Pengaturan untuk menghubungkan.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at - 300 > now) return user.access_token;
  let t: TokenResponse;
  try {
    t = await tokenRequest(mustCreds(user), { refresh_token: user.refresh_token, grant_type: 'refresh_token' });
  } catch (e) {
    if (e instanceof StravaError) throw e;
    throw new StravaError(401, 'Token Strava tidak valid lagi. Hubungkan ulang dari Pengaturan.');
  }
  await db()`update users set access_token = ${t.access_token}, refresh_token = ${t.refresh_token},
             expires_at = ${t.expires_at} where id = ${user.id}`;
  user.access_token = t.access_token;
  user.refresh_token = t.refresh_token;
  user.expires_at = t.expires_at;
  return t.access_token;
}

async function api<T>(user: User, path: string): Promise<T> {
  const token = await accessToken(user);
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 429) throw new StravaError(429, 'Batas request Strava tercapai, coba lagi 15 menit lagi.');
  if (res.status === 401) throw new StravaError(401, 'Akses Strava ditolak. Hubungkan ulang dari Pengaturan.');
  if (!res.ok) throw new StravaError(res.status, `Strava API error ${res.status}`);
  return res.json();
}

interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
}

async function upsert(userId: number, a: StravaActivity) {
  await db()`
    insert into activities (id, user_id, name, sport_type, start_date, local_date, distance_m,
                            moving_time_s, elapsed_time_s, avg_hr, elev_gain_m)
    values (${a.id}, ${userId}, ${a.name}, ${a.sport_type || a.type || 'Unknown'}, ${a.start_date},
            ${a.start_date_local.slice(0, 10)}, ${a.distance || 0}, ${a.moving_time || 0},
            ${a.elapsed_time || 0}, ${a.average_heartrate ?? null}, ${a.total_elevation_gain ?? null})
    on conflict (id) do update set
      name = excluded.name, sport_type = excluded.sport_type, start_date = excluded.start_date,
      local_date = excluded.local_date, distance_m = excluded.distance_m,
      moving_time_s = excluded.moving_time_s, elapsed_time_s = excluded.elapsed_time_s,
      avg_hr = excluded.avg_hr, elev_gain_m = excluded.elev_gain_m
    where activities.user_id = excluded.user_id`;
}

/**
 * Tarik aktivitas baru. Sync pertama mengambil ~6 bulan ke belakang (untuk grafik volume aktual),
 * berikutnya hanya sejak sync terakhir (dikurangi 3 hari untuk menangkap aktivitas yang diedit/terlambat upload).
 */
export async function syncUser(user: User): Promise<number> {
  const since = user.last_sync_at
    ? Math.floor(new Date(user.last_sync_at).getTime() / 1000) - 3 * 86400
    : Math.floor(Date.now() / 1000) - 183 * 86400;
  let page = 1;
  let count = 0;
  while (page <= 10) {
    const list = await api<StravaActivity[]>(user, `/athlete/activities?after=${since}&per_page=100&page=${page}`);
    for (const a of list) await upsert(user.id, a);
    count += list.length;
    if (list.length < 100) break;
    page++;
  }
  await db()`update users set last_sync_at = now() where id = ${user.id}`;
  return count;
}

export async function syncOneActivity(user: User, activityId: number) {
  const a = await api<StravaActivity>(user, `/activities/${activityId}`);
  await upsert(user.id, a);
}

/** Lepas koneksi Strava: cabut token di Strava (best effort), hapus token + data aktivitas lokal. */
export async function disconnectStrava(user: User, revoke = true) {
  if (revoke && user.access_token) {
    await fetch(`${OAUTH}/deauthorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: user.access_token }),
      cache: 'no-store',
    }).catch(() => {});
  }
  await db()`update users set strava_id = null, access_token = null, refresh_token = null, expires_at = null,
             last_sync_at = null where id = ${user.id}`;
  await db()`delete from activities where user_id = ${user.id} and not manual`; // catatan manual tetap disimpan
}

/**
 * Daftarkan webhook untuk aplikasi Strava milik user. Strava hanya mengizinkan 1 langganan per aplikasi,
 * jadi kalau sudah ada, pakai yang lama.
 */
export async function ensureWebhook(creds: StravaCreds): Promise<number> {
  const auth = { client_id: creds.clientId, client_secret: creds.clientSecret };
  const listRes = await fetch(`${API}/push_subscriptions?${new URLSearchParams(auth)}`, { cache: 'no-store' });
  if (listRes.ok) {
    const subs = (await listRes.json()) as { id: number; callback_url: string }[];
    const mine = subs.find((s) => s.callback_url === webhookUrl());
    if (mine) return mine.id;
    // langganan ke URL lain (mis. deploy lama): hapus supaya bisa diganti
    for (const s of subs) {
      await fetch(`${API}/push_subscriptions/${s.id}?${new URLSearchParams(auth)}`, { method: 'DELETE', cache: 'no-store' });
    }
  } else if (listRes.status === 401 || listRes.status === 403) {
    throw new StravaError(listRes.status, 'Client ID / Secret ditolak Strava.');
  }
  const res = await fetch(`${API}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...auth,
      callback_url: webhookUrl(),
      verify_token: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || '',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new StravaError(res.status, `Gagal mendaftarkan webhook (${res.status}). ${txt.slice(0, 200)}`);
  }
  return ((await res.json()) as { id: number }).id;
}
