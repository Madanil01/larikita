import { getRuns } from './db';
import { addDays, fmtShort } from './dates';
import { MARATHON_KM } from './plan';

/**
 * Prediksi waktu maraton dari satu performa. Eksponen 1.07 (bukan 1.06 Riegel klasik) supaya
 * sedikit konservatif: rumus asli cenderung terlalu optimis untuk pelari bervolume rendah.
 */
export function predictMarathon(sec: number, km: number, exponent = 1.07) {
  return sec * Math.pow(MARATHON_KM / km, exponent);
}

export interface FitnessEstimate {
  sec: number; // perkiraan waktu maraton saat ini
  source: string;
}

/**
 * Perkiraan kemampuan dari lari Strava 8 minggu terakhir (lari terbaik ≥ 5 km).
 * Lari latihan biasanya lebih pelan dari lomba, jadi hasilnya cenderung lebih lambat dari kemampuan asli,
 * yang aman: program jadi sedikit lebih ringan, bukan lebih berat.
 */
export async function estimateFromStrava(userId: number, today: string): Promise<FitnessEstimate | null> {
  const runs = await getRuns(userId, addDays(today, -56), today);
  let best: FitnessEstimate | null = null;
  for (const r of runs) {
    const km = r.distance_m / 1000;
    if (km < 5 || r.moving_time_s <= 0) continue;
    const sec = predictMarathon(r.moving_time_s, km, 1.08);
    if (!best || sec < best.sec) {
      best = { sec: Math.round(sec), source: `${r.name || 'Lari'} ${fmtShort(r.local_date)} (${km.toFixed(1)} km)` };
    }
  }
  return best;
}
