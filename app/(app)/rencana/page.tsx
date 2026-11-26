import { requireUser } from '@/lib/session';
import { getPlan, getSessions } from '@/lib/db';
import { fmtDuration, todayIn } from '@/lib/dates';
import { DAY_NAMES, DEFAULT_DAYS, DISTANCES, MARATHON_KM, distanceFor, riegel } from '@/lib/plan';
import { estimateFromStrava } from '@/lib/fitness';
import { savePlan } from './actions';

const TZS = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur'];

/** 5K/10K ditampilkan "mm:dd" kalau di bawah 1 jam, supaya cocok dengan cara input-nya */
const fmtTarget = (sec: number, km: number) =>
  km <= 10 && sec < 3600 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : fmtDuration(sec);

export default async function Rencana({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser();
  const plan = await getPlan(user.id);
  const today = todayIn(user.timezone);
  const fit = await estimateFromStrava(user.id, today);
  const dist = distanceFor(plan?.race_km);
  // Perkiraan waktu sekarang di jarak rencana (fit.sec = setara maraton)
  const runDays = plan?.run_days ? plan.run_days.split(',').map(Number) : DEFAULT_DAYS[plan?.runs_per_week ?? 4] ?? DEFAULT_DAYS[4];
  const longDay = plan?.long_day ?? runDays[runDays.length - 1];
  const fitAtDist = fit ?Math.round(riegel(fit.sec, MARATHON_KM, dist.km)) : null;
  // Long run terpanjang di rencana (di luar lomba & tes) untuk cek kesiapan
  const longest = plan
    ? Math.max(0, ...(await getSessions(plan.id)).filter((s) => s.type === 'long').map((s) => s.distance_km))
    : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form action={savePlan} className="card space-y-4 lg:col-span-2">
        <h1 className="font-display text-xl font-semibold">{plan ? 'Ubah rencana' : 'Buat rencana latihan'}</h1>
        {searchParams.error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{searchParams.error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Nama lomba</span>
            <input name="race_name" required className="input" defaultValue={plan?.race_name ?? ''} placeholder="Jakarta Running Festival" /></label>
          <label><span className="label">Kategori</span>
            <select name="race_km" className="input" defaultValue={String(dist.km)}>
              {DISTANCES.map((d) => <option key={d.km} value={d.km}>{d.label}</option>)}
            </select></label>
          <label><span className="label">Tanggal lomba</span>
            <input name="race_date" type="date" required className="input" defaultValue={plan?.race_date ?? ''} /></label>
          <label><span className="label">Target waktu</span>
            <input name="target" required className="input" defaultValue={plan ? fmtTarget(plan.target_sec, dist.km) : ''}
              placeholder="5K/10K: 28:30 · HM/FM: 2:10:00" /></label>
          <label><span className="label">Judul target (opsional)</span>
            <input name="goal_title" className="input" defaultValue={plan?.goal_title ?? ''} placeholder="10K pertama, target sub-60" /></label>
          <label><span className="label">Mulai program</span>
            <input name="start_date" type="date" className="input" defaultValue={today} /></label>
          <fieldset className="sm:col-span-2">
            <legend className="label">Hari lari (pilih 3-6)</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((n, i) => (
                <label key={i} className="cursor-pointer">
                  <input type="checkbox" name="run_days" value={i} defaultChecked={runDays.includes(i)} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-ink/10 bg-card px-3.5 py-1.5 text-sm font-medium text-ink/55 transition peer-checked:border-track peer-checked:bg-track peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-track">
                    {n}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label><span className="label">Hari long run</span>
            <select name="long_day" className="input" defaultValue={longDay}>
              {DAY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select></label>
          <div>
            <label><span className="label">Push: lebih kencang (%)</span>
              <input name="push_pct" type="number" min="0" max="15" step="1" className="input" defaultValue={plan?.push_pct ?? 0}
                placeholder="0 = normal" /></label>
            <label className="mt-2 flex items-center gap-2 text-xs text-ink/60">
              <input type="checkbox" name="push_all" defaultChecked={plan?.push_all ?? false} className="accent-[rgb(var(--track))]" />
              Easy &amp; long run ikut dipercepat (tidak disarankan)
            </label>
          </div>
          <label><span className="label">Strength training</span>
            <select name="strength" className="input" defaultValue={plan?.strength_per_week ?? 2}>
              <option value={0}>Tidak usah</option>
              <option value={1}>1x per minggu</option>
              <option value={2}>2x per minggu (disarankan)</option>
              <option value={3}>3x per minggu</option>
            </select></label>
          <label><span className="label">Volume saat ini (km/minggu)</span>
            <input name="current_km" type="number" min="0" step="1" className="input" defaultValue={plan?.current_weekly_km ?? 15} /></label>
          <label><span className="label">Volume puncak (km/minggu, opsional)</span>
            <input name="peak_km" type="number" min="0" step="1" className="input" defaultValue={plan?.peak_weekly_km ?? ''} placeholder="otomatis dari target" /></label>
          <label><span className="label">Lomba/tes terbaru (opsional)</span>
            <select name="recent_km" className="input" defaultValue="5">
              <option value="5">5K</option>
              <option value="10">10K</option>
              <option value="21.0975">Half marathon</option>
            </select></label>
          <label><span className="label">Waktunya (mm:dd atau j:mm:dd)</span>
            <input name="recent_time" className="input" placeholder="kosongkan = perkiraan dari Strava" /></label>
          <label><span className="label">Zona waktu</span>
            <select name="timezone" className="input" defaultValue={user.timezone}>
              {TZS.map((t) => <option key={t}>{t}</option>)}
            </select></label>
        </div>
        {fit && fitAtDist && (
          <p className="text-xs text-ink/50">
            Perkiraan kemampuanmu sekarang dari Strava: {dist.label} ≈{' '}
            <b className="text-ink">{fmtTarget(fitAtDist, dist.km)}</b> (dari {fit.source}).
            {plan && plan.target_sec < fitAtDist * 0.9 && (
              <span className="mt-1 block text-warn">
                Target {fmtTarget(plan.target_sec, dist.km)} itu {Math.round((1 - plan.target_sec / fitAtDist) * 100)}% lebih cepat dari
                kemampuanmu sekarang. Itu ambisius; pertimbangkan target yang lebih longgar.
              </span>
            )}
          </p>
        )}
        {plan && dist.longReadyKm > 0 && longest < dist.longReadyKm && (
          <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            Long run terpanjang di rencanamu cuma {longest} km. Untuk {dist.label} idealnya minimal ±{dist.longReadyKm} km. Waktunya
            terlalu mepet untuk volume sekarang: pertimbangkan lomba yang lebih jauh tanggalnya atau jarak yang lebih pendek dulu.
          </p>
        )}
        <button className="btn">{plan ? 'Simpan & buat ulang jadwal' : 'Buat jadwal'}</button>
        {plan && <p className="text-xs text-ink/40">Membuat ulang jadwal akan mengganti semua sesi. Data lari Strava tidak terhapus dan akan dicocokkan ulang.</p>}
      </form>
      <aside className="card space-y-3 text-sm text-ink/70">
        <h2 className="font-display text-lg font-semibold">Cara kerja</h2>
        <p>Kategori: <b>5K</b>, <b>10K</b>, <b>Half Marathon</b>, <b>Full Marathon</b>. Fun run biasanya 5K, jadi pilih 5K.</p>
        <p>Program dibagi 4 fase: <b>Base</b> (bangun volume), <b>Build</b> (interval &amp; tempo), <b>Spesifik</b> (latihan di pace lomba), dan <b>Taper</b> (pengurangan menjelang lomba: 1 minggu untuk 5K/10K, sampai 3 minggu untuk FM).</p>
        <p>Kamu pilih hari larinya; sesi berat (long run, interval/tempo) otomatis diberi jarak supaya tidak berurutan. <b>Strength</b> ditaruh di hari kosong, tidak di H-1 long run atau sesi kualitas, dan berhenti 3 hari sebelum lomba.</p>
        <p><b>Push</b> mempercepat tempo, interval, sesi pace lomba, dan target tes sebanyak persen yang kamu isi (mis. 10% dari 6:00/km = 5:24/km). Easy &amp; long run tetap santai kecuali kamu centang, karena di situlah pemulihan terjadi. Target lomba tidak ikut berubah.</p>
        <p>Pace dimulai dari <b>kemampuanmu sekarang</b> (dari lomba terbaru atau data Strava), lalu naik bertahap ke pace target.</p>
        <p>Volume naik maksimal 10% (dan maks 5 km) per minggu, dengan minggu ringan setiap minggu ke-4. Panjang long run dibatasi sesuai jarak lomba (mis. 10K maks ±18 km, FM maks 32 km / ±3 jam).</p>
        <p>Tes 5K (untuk lomba 5K/10K) atau 10K (untuk HM/FM) dihitung dengan rumus Riegel dari kemampuan yang diharapkan di minggu itu.</p>
        <p>Sesi dianggap selesai kalau ada lari di Strava pada tanggal itu (atau digeser ±1 hari) dengan jarak minimal 50% rencana.</p>
        <p className="text-xs text-ink/40">Ini program generik berbasis aturan, bukan pengganti pelatih. Kalau badan bilang capek, turunkan, jangan dipaksa.</p>
      </aside>
    </div>
  );
}
