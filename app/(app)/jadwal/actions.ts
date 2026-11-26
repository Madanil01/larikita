'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { addDays, parseClock, todayIn } from '@/lib/dates';

const back = (week: string, msg?: string): never =>
  redirect(`/jadwal${msg ? `?error=${encodeURIComponent(msg)}` : ''}${week ? `#w${week}` : ''}`);

/**
 * Catat lari / strength secara manual. Disimpan sebagai aktivitas biasa (manual = true, id negatif),
 * jadi otomatis ikut pencocokan jadwal, grafik volume, kepatuhan, dan analisis.
 */
export async function logManual(f: FormData) {
  const user = await requireUser();
  const str = (k: string) => String(f.get(k) ?? '').trim();
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
  back(week);
}

export async function deleteManual(f: FormData) {
  const user = await requireUser();
  const id = String(f.get('id') ?? '');
  const week = String(f.get('week') ?? '');
  if (/^-\d+$/.test(id)) await db()`delete from activities where id = ${id} and user_id = ${user.id} and manual`;
  revalidatePath('/jadwal');
  revalidatePath('/dashboard');
  back(week);
}
