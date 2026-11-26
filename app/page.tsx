import Link from 'next/link';
import PendingOverlay from '@/components/PendingOverlay';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { getUserId } from '@/lib/session';
import { login, register } from './auth-actions';

const POINTS = [
  ['5K sampai 42K', 'Program 5K, 10K, half, dan full marathon dari target dan tanggal lombamu.'],
  ['Pace yang masuk akal', 'Dimulai dari kemampuanmu sekarang, naik bertahap. Bisa di-push kalau mau.'],
  ['Hari pilihanmu', 'Pilih hari lari sendiri; strength training diselipkan otomatis.'],
  ['Strava atau manual', 'Lari dicentang otomatis dari Strava, atau catat sendiri.'],
];

/** Contoh minggu latihan, sekadar ilustrasi di halaman depan */
const WEEK = [
  ['Sen', 0, ''], ['Sel', 6, 'Easy'], ['Rab', 0, ''], ['Kam', 8, 'Tempo'], ['Jum', 0, ''], ['Sab', 5, 'Easy'], ['Min', 14, 'Long'],
] as const;

export default async function Home({ searchParams }: { searchParams: { error?: string; mode?: string } }) {
  if (await getUserId()) redirect('/dashboard');
  const daftar = searchParams.mode === 'daftar';
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-10 md:grid-cols-[1.15fr_1fr] md:px-8">
      <section>
        <Logo size="lg" />
        <h1 className="mt-12 max-w-xl font-display text-[2.75rem] font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Latihan yang menyesuaikan <span className="text-track">larimu</span>, bukan sebaliknya.
        </h1>
        <p className="mt-5 max-w-md text-ink/60">Rencana latihan dari target lombamu, lalu dicocokkan dengan lari yang benar-benar kamu lakukan.</p>

        {/* ilustrasi minggu latihan */}
        <div className="mt-9 max-w-md rounded-2xl border border-ink/[0.07] bg-card p-4">
          <div className="flex items-baseline justify-between text-xs text-ink/50">
            <span>Contoh minggu ke-6 · Build</span><span>33 km</span>
          </div>
          <div className="mt-3 flex h-24 items-end gap-2">
            {WEEK.map(([d, km, t]) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={`w-full rounded-md ${t === 'Long' ? 'bg-track' : t === 'Tempo' ? 'bg-volt' : km ? 'bg-track/25' : 'bg-ink/[0.05]'}`}
                  style={{ height: km ? `${(km / 14) * 72}px` : '6px' }} title={t ? `${t} ${km} km` : 'Istirahat'} />
                <span className="text-[10px] text-ink/45">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <dl className="mt-9 grid max-w-xl gap-x-8 gap-y-5 sm:grid-cols-2">
          {POINTS.map(([t, d]) => (
            <div key={t}>
              <dt className="text-sm font-semibold">{t}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink/55">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="w-full rounded-3xl border border-ink/[0.07] bg-card p-6 shadow-[0_20px_50px_-20px_rgb(var(--ink)/0.15)] md:p-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{daftar ? 'Buat akun' : 'Selamat datang kembali'}</h2>
        <p className="mt-1 text-sm text-ink/50">{daftar ? 'Gratis. Strava bisa dihubungkan belakangan.' : 'Masuk untuk lanjut ke jadwalmu.'}</p>
        <div className="mt-6 grid grid-cols-2 rounded-full bg-paper p-1 text-sm font-medium">
          <Link href="/?mode=masuk" aria-current={!daftar ? 'page' : undefined}
            className={`rounded-full py-1.5 text-center transition ${!daftar ? 'bg-card shadow-sm' : 'text-ink/50 hover:text-ink'}`}>Masuk</Link>
          <Link href="/?mode=daftar" aria-current={daftar ? 'page' : undefined}
            className={`rounded-full py-1.5 text-center transition ${daftar ? 'bg-card shadow-sm' : 'text-ink/50 hover:text-ink'}`}>Daftar</Link>
        </div>
        <form action={daftar ? register : login} className="mt-5 space-y-3.5">
          <PendingOverlay label={daftar ? 'Membuat akun…' : 'Masuk…'} />
          {daftar && (
            <div>
              <label className="label" htmlFor="name">Nama</label>
              <input id="name" name="name" required maxLength={80} className="input py-2.5" autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input py-2.5" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={daftar ? 8 : undefined} className="input py-2.5"
              autoComplete={daftar ? 'new-password' : 'current-password'} />
          </div>
          <button className="btn mt-2 w-full py-3">{daftar ? 'Buat akun' : 'Masuk'}</button>
        </form>
        <p className="mt-5 text-xs leading-relaxed text-ink/45">Setelah daftar, hubungkan Strava di Pengaturan (opsional). Kami hanya membaca aktivitasmu.</p>
      </section>
    </main>
  );
}
