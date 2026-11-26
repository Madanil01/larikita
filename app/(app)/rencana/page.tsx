import { requireUser } from '@/lib/session';
import PendingOverlay from '@/components/PendingOverlay';
import Link from 'next/link';
import { MAX_PLANS, db, getPlans, getSessions, type Plan } from '@/lib/db';
import { addDays, diffDays, fmtDuration, fmtLong, fmtShort, todayIn } from '@/lib/dates';
import { DAY_NAMES, DEFAULT_DAYS, DISTANCES, MARATHON_KM, distanceFor, riegel } from '@/lib/plan';
import { estimateFromStrava } from '@/lib/fitness';
import Icon from '@/components/Icon';
import RegenConfirm from '@/components/RegenConfirm';
import { deletePlan, savePlan } from './actions';

const TZS = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur'];

/** 5K/10K ditampilkan "mm:dd" kalau di bawah 1 jam, supaya cocok dengan cara input-nya */
const fmtTarget = (sec: number, km: number) =>
  km <= 10 && sec < 3600 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : fmtDuration(sec);

/** Dua rencana bertumpuk kalau rentang mulai–lomba-nya beririsan */
const overlaps = (a: Plan, b: Plan) => a.id !== b.id && a.start_date <= b.race_date && b.start_date <= a.race_date;

function PlanList({ plans, today, error }: { plans: Plan[]; today: string; error?: string }) {
  const full = plans.length >= MAX_PLANS;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Rencana</h1>
          <p className="mt-1 text-sm text-ink/50">Kamu bisa menjalankan beberapa rencana sekaligus, maksimal {MAX_PLANS}.</p>
        </div>
        {!full && <Link href="/rencana?baru=1" className="btn">+ Rencana baru</Link>}
      </div>
      {error && <p className="rounded-xl border border-bad/20 bg-bad/10 px-4 py-2 text-sm text-bad">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => {
          const dist = distanceFor(p.race_km);
          const left = diffDays(today, p.race_date);
          const running = p.start_date <= today && left >= 0;
          const clash = plans.filter((o) => overlaps(p, o));
          return (
            <section key={p.id} className={`card flex flex-col ${left < 0 ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-track">{dist.label}</p>
                  <h2 className="mt-0.5 truncate font-display text-lg font-semibold">{p.race_name}</h2>
                  <p className="text-sm text-ink/50">{fmtLong(p.race_date)}</p>
                </div>
                <span className={`chip shrink-0 ${left < 0 ? 'bg-ink/[0.06] text-ink/50' : running ? 'bg-ok/10 text-ok' : 'bg-volt/25 text-warn'}`}>
                  {left < 0 ? 'Selesai' : running ? `Berjalan · ${left} hari` : `Mulai ${fmtShort(p.start_date)}`}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-ink/45">Target</dt><dd className="font-medium">{fmtTarget(p.target_sec, dist.km)}</dd></div>
                <div><dt className="text-xs text-ink/45">Durasi</dt><dd className="font-medium">{p.total_weeks} minggu</dd></div>
                <div><dt className="text-xs text-ink/45">Lari/minggu</dt><dd className="font-medium">{p.runs_per_week}x</dd></div>
              </dl>
              {clash.length > 0 && left >= 0 && (
                <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-xs leading-relaxed text-warn">
                  Bertumpuk dengan {clash.map((c) => c.race_name).join(', ')}. Jadwalnya dihitung terpisah, jadi jaga total volume
                  mingguan supaya tidak berlebihan.
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <Link href={`/dashboard?plan=${p.id}`} className="btn-ghost">Ringkasan</Link>
                <Link href={`/jadwal?plan=${p.id}`} className="btn-ghost">Jadwal</Link>
                <Link href={`/rencana?id=${p.id}`} className="btn-ghost">Ubah</Link>
                <details className="relative ml-auto">
                  <summary className="cursor-pointer list-none text-xs text-ink/40 hover:text-bad">Hapus</summary>
                  <form action={deletePlan} className="absolute right-0 z-10 mt-2 w-60 rounded-xl border border-ink/[0.07] bg-card p-3 text-xs shadow-lg">
                    <PendingOverlay label="Menghapus rencana…" />
                    <input type="hidden" name="id" value={p.id} />
                    <p className="text-ink/60">Hapus rencana &amp; semua sesinya? Data lari Strava tidak ikut terhapus.</p>
                    <button className="mt-2 w-full rounded-full bg-bad px-3 py-1.5 font-medium text-white hover:bg-bad/90">Ya, hapus</button>
                  </form>
                </details>
              </div>
            </section>
          );
        })}
        {!full && (
          <Link href="/rencana?baru=1"
            className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/10 text-sm text-ink/45 transition hover:border-track/40 hover:text-track">
            <Icon name="flag" className="h-6 w-6" />
            Tambah rencana untuk lomba lain
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function Rencana({ searchParams }: { searchParams: { error?: string; id?: string; baru?: string; ok?: string } }) {
  const user = await requireUser();
  const today = todayIn(user.timezone);
  const plans = await getPlans(user.id);
  const plan = searchParams.id ? plans.find((p) => String(p.id) === searchParams.id) ?? null : null;
  // Tanpa ?id / ?baru: tampilkan daftar rencana (atau langsung form kalau belum punya rencana sama sekali)
  if (!plan && !searchParams.baru && plans.length > 0) return <PlanList plans={plans} today={today} error={searchParams.error} />;
  if (!plan && plans.length >= MAX_PLANS) return <PlanList plans={plans} today={today} error={`Maksimal ${MAX_PLANS} rencana. Hapus rencana lama dulu.`} />;
  const fit = await estimateFromStrava(user.id, today);
  const dist = distanceFor(plan?.race_km);
  // Perkiraan waktu sekarang di jarak rencana (fit.sec = setara maraton)
  const runDays = plan?.run_days ? plan.run_days.split(',').map(Number) : DEFAULT_DAYS[plan?.runs_per_week ?? 4] ?? DEFAULT_DAYS[4];
  const longDay = plan?.long_day ?? runDays[runDays.length - 1];
  const fitAtDist = fit ?Math.round(riegel(fit.sec, MARATHON_KM, dist.km)) : null;
  // Long run terpanjang di rencana (di luar lomba & tes) untuk cek kesiapan
  const planSessions = plan ? await getSessions(plan.id) : [];
  const longest = Math.max(0, ...planSessions.filter((s) => s.type === 'long').map((s) => s.distance_km));
  // Untuk popup konfirmasi: sesi yang diubah manual (akan ditimpa) dan catatan lari manual di masa rencana ini
  const edited = planSessions.filter((s) => s.edited).length;
  const manualLogs = plan
    ? (await db()<{ n: number }[]>`select count(*)::int as n from activities where user_id = ${user.id} and manual
        and local_date between ${addDays(plan.start_date, -2)} and ${plan.race_date}`)[0].n
    : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form action={savePlan} className="card space-y-4 lg:col-span-2">
        <PendingOverlay label="Menyusun jadwal…" />
        {plan && <input type="hidden" name="plan_id" value={plan.id} />}
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold">{plan ? `Ubah rencana · ${plan.race_name}` : plans.length ? 'Rencana baru' : 'Buat rencana latihan'}</h1>
          {plans.length > 0 && <Link href="/rencana" className="text-sm text-ink/50 hover:text-ink">Batal</Link>}
        </div>
        {!plan && plans.some((p) => p.race_date >= today) && (
          <p className="rounded-xl bg-paper px-3 py-2 text-xs text-ink/55">
            Rencana ini akan berjalan bersamaan dengan rencana lain yang sudah ada. Rencana lama tidak diubah.
          </p>
        )}
        {searchParams.error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{searchParams.error}</p>}
        {searchParams.ok && <p className="rounded-xl border border-ok/20 bg-ok/10 px-3 py-2 text-sm text-ok">Detail rencana disimpan. Jadwal tidak diubah.</p>}
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
        {plan ? <RegenConfirm edited={edited} manualLogs={manualLogs} /> : <button className="btn">Buat jadwal</button>}
        {plan && edited > 0 && (
          <p className="text-xs text-info">{edited} sesi di rencana ini sudah kamu ubah manual di Jadwal (bertanda “diubah”).</p>
        )}
        {plan && <p className="text-xs text-ink/40">Membuat ulang jadwal akan mengganti semua sesi rencana ini (rencana lain tidak berubah). Data lari Strava tidak terhapus dan akan dicocokkan ulang.</p>}
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
