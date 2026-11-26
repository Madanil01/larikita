import Link from 'next/link';
import { requireUser } from '@/lib/session';
import PendingOverlay from '@/components/PendingOverlay';
import { appUrl, stravaCreds, webhookUrl } from '@/lib/strava';
import { disconnect, enableWebhook, removeStravaApp, saveStravaApp } from './actions';

export const dynamic = 'force-dynamic';

export default async function Pengaturan({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const user = await requireUser();
  const creds = stravaCreds(user);
  const ownApp = !!user.strava_client_id;
  const connected = !!user.access_token;
  const domain = new URL(appUrl()).hostname;
  const isLocal = domain === 'localhost' || domain === '127.0.0.1';

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Pengaturan</h1>
        <Link href="/panduan#strava" className="btn-ghost">Panduan menghubungkan Strava</Link>
      </div>

      <section className="card space-y-2">
        <h2 className="font-display text-lg font-semibold">Akun</h2>
        <p className="muted">{user.name} · {user.email ?? '—'} · zona waktu {user.timezone}</p>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">1. Aplikasi Strava</h2>
          <p className="muted">
            Strava membatasi tiap aplikasi API ke sedikit atlet. Supaya tidak rebutan kuota, buat aplikasi Strava sendiri (gratis,
            2 menit) lalu isi kredensialnya di sini.
          </p>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/70">
          <li>
            Buka{' '}
            <a className="font-medium text-track underline" href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">
              strava.com/settings/api
            </a>{' '}
            dengan akun Strava yang mau dihubungkan.
          </li>
          <li>
            Nama aplikasi bebas, kategori <b>Training</b>, website <code className="text-ink">{appUrl()}</code>.
          </li>
          <li>
            <b>Authorization Callback Domain</b>: <code className="rounded bg-ink/10 px-1.5 text-ink">{domain}</code>
          </li>
          <li>Salin <b>Client ID</b> dan <b>Client Secret</b> ke form di bawah.</li>
        </ol>
        <form action={saveStravaApp} className="grid gap-3 sm:grid-cols-2">
          <PendingOverlay label="Menyimpan…" />
          <div>
            <label className="label" htmlFor="client_id">Client ID</label>
            <input id="client_id" name="client_id" inputMode="numeric" required defaultValue={user.strava_client_id ?? ''}
              className="input" placeholder="123456" />
          </div>
          <div>
            <label className="label" htmlFor="client_secret">Client Secret</label>
            <input id="client_secret" name="client_secret" type="password" autoComplete="off" className="input"
              placeholder={user.strava_client_secret ? '•••••••• (kosongkan kalau tidak diubah)' : 'isi client secret'} />
          </div>
          <div className="sm:col-span-2">
            <button className="btn">Simpan</button>
          </div>
        </form>
        {ownApp && (
          <form action={removeStravaApp}>
            <PendingOverlay label="Menghapus…" />
            <button className="btn-ghost">Hapus aplikasi pribadi</button>
          </form>
        )}
        {!ownApp && creds && <p className="text-xs text-ink/40">Saat ini memakai aplikasi Strava default server (kuota terbatas).</p>}
        {ownApp && !creds && (
          <p className="text-sm text-warn">Client Secret tidak bisa dibaca (kunci server berubah). Isi ulang Client Secret.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">2. Koneksi Strava</h2>
        {connected ? (
          <>
            <p className="muted">Tersambung ke atlet Strava #{user.strava_id}.</p>
            <form action={disconnect}>
              <PendingOverlay label="Memutuskan Strava…" />
              <button className="btn-ghost">Putuskan Strava &amp; hapus data aktivitas</button>
            </form>
          </>
        ) : creds ? (
          // Sesuai panduan brand Strava: tombol "Connect with Strava" berwarna oranye
          <a href="/api/strava/connect"
            className="inline-flex rounded-md bg-[#FC5200] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e04a00]">
            Connect with Strava
          </a>
        ) : (
          <p className="muted">Simpan aplikasi Strava di langkah 1 dulu.</p>
        )}
      </section>

      {ownApp && (
        <section className="card space-y-3">
          <h2 className="font-display text-lg font-semibold">3. Sync otomatis (webhook)</h2>
          <p className="muted">
            Dengan webhook, lari baru masuk beberapa detik setelah upload ke Strava. Tanpa webhook, data tetap masuk lewat tombol
            &quot;Muat ulang&quot; dan sync harian.
          </p>
          {user.strava_webhook_id ? (
            <p className="text-sm text-ok">Aktif (subscription #{user.strava_webhook_id}).</p>
          ) : isLocal ? (
            <p className="text-sm text-ink/50">Webhook butuh URL publik, tidak bisa dari localhost ({webhookUrl()}).</p>
          ) : (
            <form action={enableWebhook}>
              <PendingOverlay label="Mengaktifkan webhook…" />
              <button className="btn">Aktifkan webhook</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
