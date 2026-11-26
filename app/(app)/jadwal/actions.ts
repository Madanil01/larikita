'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { addDays, diffDays, mondayOf, parseClock, todayIn } from '@/lib/dates';
import { SESSION_TYPES, type SessionType } from '@/lib/plan';

/** Kembali ke Jadwal rencana yang sama (?plan=), dengan pesan error dan/atau lompat ke minggu tertentu */
function backTo(plan: string, week: string, msg?: string, ok?: string): never {
  const q = new URLSearchParams();
  if (/^\d+$/.test(plan)) q.set('plan', plan);
  if (msg) q.set('error', msg);
  if (ok) q.set('ok', ok);
  const qs = q.toString();
  return redirect(`/jadwal${qs ? `?${qs}` : ''}${week ? `#w${week}` : ''}`);
}

/**
 * Catat lari / strength secara manual. Disimpan sebagai aktivitas biasa (manual = true, id negatif),
 * jadi otomatis ikut pencocokan jadwal, grafik volume, kepatuhan, dan analisis.
 */
export async function logManual(f: FormData) {
  const user = await requireUser();
  const str = (k: string) => String(f.get(k) ?? '').trim();
  const back = (w: string, m?: string) => backTo(str('plan'), w, m);
  const today = todayIn(user.timezone);
  const sessionId = Number(str('session_id'));
  let s: { date: string; type: string; title: string; week: number | null };
  if (sessionId) {
    // dari tombol Catat di sebuah sesi
    const rows = await db()<{ date: string; type: string; title: string; week: number }[]>`
      select s.date, s.type, s.title, s.week from sessions s join plans p on p.id = s.plan_id
      where s.id = ${sessionId} and p.user_id = ${user.id}`;
    if (!rows[0]) return back('', 'Sesi tidak ditemukan.');
    s = rows[0];
  } else {
    // dari tombol "Catat lari" umum di atas jadwal
    const d = str('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return back('', 'Tanggal wajib diisi.');
    s = str('kind') === 'strength'
      ? { date: d, type: 'strength', title: 'Strength', week: null }
      : { date: d, type: 'easy', title: 'Lari', week: null };
  }
  const week = s.week ? String(s.week) : '';

  const date = /^\d{4}-\d{2}-\d{2}$/.test(str('date')) ? str('date') : s.date;
  if (date > today) return back(week, 'Tidak bisa mencatat untuk tanggal yang belum lewat.');
  if (date < addDays(today, -90)) return back(week, 'Hanya bisa mencatat sampai 90 hari ke belakang.');
  if (sessionId && (date < addDays(s.date, -7) || date > addDays(s.date, 7))) return back(week, 'Tanggal terlalu jauh dari jadwal sesi.');

  const strength = s.type === 'strength';
  const sec = parseClock(str('time'));
  const km = strength ? 0 : Number(str('km').replace(',', '.'));
  const hrRaw = str('hr');
  const hr = hrRaw ? Number(hrRaw) : null;

  if (!strength) {
    if (!(km > 0 && km <= 100)) return back(week, 'Jarak harus antara 0,1 dan 100 km.');
    if (!sec) return back(week, 'Isi durasi lari, contoh 32:15 atau 1:05:30.');
    const pace = sec / km;
    if (pace < 120 || pace > 1200) return back(week, 'Pace di luar wajar (2:00–20:00/km). Cek lagi jarak & durasinya.');
  } else if (str('time') && !sec) {
    return back(week, 'Format durasi salah. Contoh: 30 (menit) atau 45:00.');
  }
  if (hr !== null && !(hr >= 60 && hr <= 230)) return back(week, 'HR rata-rata harus antara 60 dan 230.');

  const name = str('note').slice(0, 120) || `${s.title} (manual)`;
  await db()`
    insert into activities (id, user_id, name, sport_type, start_date, local_date, distance_m, moving_time_s,
                            elapsed_time_s, avg_hr, manual)
    values (-nextval('manual_activity_seq'), ${user.id}, ${name}, ${strength ? 'WeightTraining' : 'Run'},
            (${date}::date + time '07:00') at time zone ${user.timezone}, ${date}, ${km * 1000}, ${sec ?? 0},
            ${sec ?? 0}, ${hr}, true)`;
  revalidatePath('/jadwal');
  revalidatePath('/dashboard');
  backTo(String(f.get('plan') ?? ''), week, undefined, strength ? 'Strength tercatat.' : 'Lari tercatat dan dicocokkan ke jadwal.');
}

export async function deleteManual(f: FormData) {
  const user = await requireUser();
  const id = String(f.get('id') ?? '');
  const week = String(f.get('week') ?? '');
  if (/^-\d+$/.test(id)) await db()`delete from activities where id = ${id} and user_id = ${user.id} and manual`;
  revalidatePath('/jadwal');
  revalidatePath('/dashboard');
  backTo(String(f.get('plan') ?? ''), week, undefined, 'Catatan manual dihapus.');
}


/**
 * Ubah sesi (session_id diisi) atau tambah sesi baru ke rencana (plan). Sesi ditandai edited = true,
 * jadi halaman Rencana bisa memperingatkan bahwa perubahan ini tertimpa kalau jadwal dibuat ulang.
 */
export async function saveSession(f: FormData) {
  const user = await requireUser();
  const str = (k: string) => String(f.get(k) ?? '').trim();
  const planId = Number(str('plan'));
  const sessionId = Number(str('session_id')) || null;
  const back = (w: string, m?: string) => backTo(str('plan'), w, m);
  const [plan] = await db()<{ id: number; start_date: string; race_date: string }[]>`
    select id, start_date, race_date from plans where id = ${planId} and user_id = ${user.id}`;
  if (!plan) return back('', 'Rencana tidak ditemukan.');

  const date = str('date');
  const type = str('type') as SessionType;
  const strength = type === 'strength';
  const km = strength ? 0 : Number(str('km').replace(',', '.'));
  const pace = str('pace') ? parseClock(str('pace')) : null;
  const title = str('title').slice(0, 80) || SESSION_TYPES[type];
  const notes = str('notes').slice(0, 200) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return back(str('week'), 'Tanggal wajib diisi.');
  if (date < addDays(plan.start_date, -7) || date > plan.race_date) return back(str('week'), 'Tanggal harus di dalam masa rencana (sampai hari lomba).');
  if (!(type in SESSION_TYPES)) return back(str('week'), 'Jenis sesi tidak dikenal.');
  if (!strength && !(km > 0 && km <= 100)) return back(str('week'), 'Jarak harus antara 0,1 dan 100 km.');
  if (str('pace') && (!pace || pace < 120 || pace > 1200)) return back(str('week'), 'Format pace salah. Contoh: 5:45 (menit:detik per km).');

  // Minggu & fase ikut tanggal baru: fase diambil dari sesi lain di minggu itu
  const week = Math.floor(diffDays(mondayOf(plan.start_date), mondayOf(date)) / 7) + 1;
  const [ph] = await db()<{ phase: string }[]>`
    select phase from sessions where plan_id = ${plan.id} and week = ${week} and id <> ${sessionId ?? 0} limit 1`;
  const phase = ph?.phase ?? (date >= addDays(plan.race_date, -6) ? 'Taper' : 'Base');

  if (sessionId) {
    const res = await db()`
      update sessions set date = ${date}, week = ${week}, phase = ${phase}, type = ${type}, title = ${title},
        distance_km = ${km}, pace_sec = ${strength ? null : pace},
        target_sec = case when ${type} in ('test', 'race') then target_sec else null end,
        notes = ${notes}, edited = true
      where id = ${sessionId} and plan_id = ${plan.id}`;
    if (!res.count) return back(str('week'), 'Sesi tidak ditemukan.');
  } else {
    await db()`
      insert into sessions (plan_id, date, week, phase, type, title, distance_km, pace_sec, target_sec, notes, edited)
      values (${plan.id}, ${date}, ${week}, ${phase}, ${type}, ${title}, ${km}, ${strength ? null : pace}, null, ${notes}, true)`;
  }
  revalidatePath('/jadwal');
  revalidatePath('/dashboard');
  backTo(str('plan'), String(week), undefined, sessionId ? 'Sesi disimpan.' : 'Sesi ditambahkan.');
}

export async function deleteSession(f: FormData) {
  const user = await requireUser();
  const id = Number(f.get('session_id'));
  if (id) {
    await db()`delete from sessions s using plans p
               where s.id = ${id} and p.id = s.plan_id and p.user_id = ${user.id}`;
  }
  revalidatePath('/jadwal');
  revalidatePath('/dashboard');
  backTo(String(f.get('plan') ?? ''), String(f.get('week') ?? ''), undefined, 'Sesi dihapus.');
}
