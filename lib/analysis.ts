import type { Activity } from './db';
import type { SessionWithStatus } from './stats';
import { addDays, fmtPace, fmtShort, dayName } from './dates';

const QUALITY = new Set(['tempo', 'interval', 'mp', 'test', 'race']);
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Analisis harian berbasis aturan (tanpa AI berbayar): latihan hari ini vs rencana + tren 7 hari. */
export function buildAnalysis(today: string, sessions: SessionWithStatus[], runs: Activity[], planStart: string): string {
  const out: string[] = [];
  const todaySessions = sessions.filter((s) => s.date === today);
  const todayRuns = runs.filter((r) => r.local_date === today);
  const km = todayRuns.reduce((a, r) => a + r.distance_m / 1000, 0);
  const sec = todayRuns.reduce((a, r) => a + r.moving_time_s, 0);
  const pace = km > 0 ? sec / km : null;
  const hrRuns = todayRuns.filter((r) => r.avg_hr);
  const hr = hrRuns.length ? Math.round(hrRuns.reduce((a, r) => a + (r.avg_hr || 0) * r.moving_time_s, 0) / hrRuns.reduce((a, r) => a + r.moving_time_s, 0)) : null;

  const plan = todaySessions.find((s) => s.type !== 'strength');
  const strengthToday = todaySessions.find((s) => s.type === 'strength');
  if (!plan && strengthToday) {
    out.push(`Hari ini tanpa lari, jadwalnya ${strengthToday.title}.${strengthToday.status === 'done' ? ' Sudah tercatat di Strava, mantap.' : ''}`);
    if (strengthToday.status !== 'done' && strengthToday.notes) out.push(strengthToday.notes);
  }
  if (plan && km > 0) {
    const pct = Math.round((km / plan.distance_km) * 100);
    out.push(`Hari ini: ${plan.title} ${plan.distance_km} km. Anda lari ${r1(km)} km (${pct}% dari rencana) dengan pace ${fmtPace(pace)}${hr ? `, HR rata-rata ${hr}` : ''}.`);
    if (pct < 80) out.push('Jarak masih di bawah rencana. Tidak apa-apa sesekali, tapi jangan ditebus dengan menambah jarak besok.');
    else if (pct > 120) out.push('Jarak jauh melebihi rencana. Hati-hati menumpuk kelelahan; jaga sesi berikutnya tetap sesuai jadwal.');
    if (plan.pace_sec && pace) {
      const d = pace - plan.pace_sec;
      if (QUALITY.has(plan.type)) {
        if (Math.abs(d) <= 10) out.push(`Pace sesuai target (${fmtPace(plan.pace_sec)}). Mantap.`);
        else if (d > 10) out.push(`Pace ${Math.round(d)} detik/km lebih lambat dari target ${fmtPace(plan.pace_sec)}. Kalau ini pace rata-rata termasuk pemanasan, wajar; cek split bagian intinya di Strava.`);
        else out.push(`Pace ${Math.round(-d)} detik/km lebih cepat dari target. Bagus, tapi pastikan bukan karena memaksa; pace lomba yang konsisten lebih penting.`);
      } else if (d < -20) {
        out.push(`Untuk sesi ${plan.type === 'long' ? 'long run' : 'easy'}, pace Anda ${Math.round(-d)} detik/km lebih cepat dari anjuran ${fmtPace(plan.pace_sec)}. Lari easy sebaiknya benar-benar santai supaya pemulihan terjaga.`);
      } else {
        out.push('Intensitas sudah pas untuk sesi ringan.');
      }
    }
  } else if (plan) {
    out.push(`Belum ada lari tercatat hari ini. Rencana: ${plan.title} ${plan.distance_km} km${plan.pace_sec ? ` di sekitar ${fmtPace(plan.pace_sec)}` : ''}.`);
    if (plan.notes) out.push(plan.notes);
  } else if (strengthToday) {
    if (km > 0) out.push(`Anda juga lari ${r1(km)} km hari ini; pastikan santai supaya kaki tetap segar.`);
  } else if (km > 0) {
    out.push(`Hari ini jadwal istirahat, tapi Anda lari ${r1(km)} km (${fmtPace(pace)}). Kalau santai tidak masalah; istirahat tetap bagian dari latihan.`);
  } else {
    out.push('Hari ini jadwal istirahat. Fokus tidur cukup dan mobilitas ringan.');
  }

  // Tren 7 hari terakhir
  const from = addDays(today, -6) > planStart ? addDays(today, -6) : planStart;
  const planned7 = sessions.filter((s) => s.date >= from && s.date <= today && s.type !== 'strength');
  const plannedKm = planned7.reduce((a, s) => a + s.distance_km, 0);
  const actualKm = runs.filter((r) => r.local_date >= from && r.local_date <= today).reduce((a, r) => a + r.distance_m / 1000, 0);
  const missed = planned7.filter((s) => s.status === 'missed').length;
  if (plannedKm > 0) {
    const p = Math.round((actualKm / plannedKm) * 100);
    out.push(`${from === planStart ? 'Sejak program dimulai' : '7 hari terakhir'}: ${r1(actualKm)} km dari rencana ${r1(plannedKm)} km (${p}%)${missed ? `, ${missed} sesi terlewat` : ''}.` +
      (p < 70 ? ' Volume tertinggal; kembali ke jadwal pelan-pelan, jangan dikejar sekaligus.' : p > 115 ? ' Volume di atas rencana; waspadai risiko cedera.' : ' Konsistensi bagus.'));
  }

  const next = sessions.find((s) => s.date > today);
  if (next) out.push(`Sesi berikutnya: ${dayName(next.date)} ${fmtShort(next.date)}, ${next.title}${next.distance_km ? ` ${next.distance_km} km` : ''}${next.pace_sec ? ` (${fmtPace(next.pace_sec)})` : ''}.`);

  return out.join('\n');
}
