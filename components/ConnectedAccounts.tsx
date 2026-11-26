import Link from 'next/link';
import type { User } from '@/lib/db';
import { db } from '@/lib/db';
import { stravaCreds } from '@/lib/strava';
import Avatar from './Avatar';
import Icon from './Icon';
import SyncButton from './SyncButton';

/** "baru saja", "12 menit lalu", "3 jam lalu", "2 hari lalu" */
function ago(d: Date | string | null): string {
  if (!d) return 'belum pernah';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
      <dt className="text-ink/50">{k}</dt>
      <dd className="truncate text-right font-medium text-ink/85">{v}</dd>
    </div>
  );
}

/** Kartu dashboard: akun LariKita + akun Strava yang terhubung */
export default async function ConnectedAccounts({ user, className = '' }: { user: User; className?: string }) {
  const connected = !!user.access_token;
  const creds = stravaCreds(user);
  const [count] = await db()<{ strava: number; manual: number }[]>`
    select count(*) filter (where not manual)::int as strava, count(*) filter (where manual)::int as manual
    from activities where user_id = ${user.id}`;
  const since = user.created_at
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: user.timezone }).format(new Date(user.created_at))
    : null;

  return (
    <section className={`card flex flex-col ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Akun terhubung</h2>
        <Link href="/pengaturan" className="text-xs font-medium text-ink/50 hover:text-track">Kelola</Link>
      </div>

      {/* Akun LariKita */}
      <div className="mt-4 flex items-center gap-3">
        <Avatar name={user.name} src={user.avatar} size={44} />
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-ink/50">{user.email ?? 'Login lewat Strava'}</p>
        </div>
      </div>
      <dl className="mt-3 divide-y divide-ink/[0.06] border-t border-ink/[0.06]">
        {since && <Row k="Bergabung" v={since} />}
        <Row k="Zona waktu" v={user.timezone.replace('Asia/', '')} />
      </dl>

      {/* Strava */}
      <div className={`mt-4 rounded-xl p-3.5 ${connected ? 'bg-paper' : 'border border-dashed border-ink/15'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#FC5200]" aria-hidden />
            Strava
          </p>
          {connected ? (
            <span className="chip bg-ok/10 text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Tersambung</span>
          ) : (
            <span className="chip bg-warn/10 text-warn">Belum tersambung</span>
          )}
        </div>

        {connected ? (
          <>
            <dl className="mt-2">
              <Row k="ID atlet" v={
                <a href={`https://www.strava.com/athletes/${user.strava_id}`} target="_blank" rel="noreferrer" className="hover:text-track hover:underline">
                  #{user.strava_id}
                </a>} />
              <Row k="Sinkron terakhir" v={ago(user.last_sync_at)} />
              <Row k="Aktivitas tersimpan" v={`${count?.strava ?? 0} dari Strava${count?.manual ? ` · ${count.manual} manual` : ''}`} />
              <Row k="Mode sinkron" v={user.strava_webhook_id ? 'Otomatis (webhook)' : 'Manual + harian'} />
              <Row k="Aplikasi API" v={creds?.own ? 'Pribadi' : 'Bawaan server'} />
            </dl>
            <div className="mt-3"><SyncButton /></div>
          </>
        ) : (
          <>
            <p className="mt-2 text-xs leading-relaxed text-ink/55">
              Sambungkan supaya lari tercentang otomatis. Tanpa Strava, kamu tetap bisa mencatat lari manual di Jadwal.
              {count?.manual ? ` (${count.manual} catatan manual tersimpan.)` : ''}
            </p>
            <Link href="/pengaturan" className="btn mt-3 w-full">
              <Icon name="link" className="h-4 w-4" /> Hubungkan Strava
            </Link>
            <Link href="/panduan#strava" className="mt-2 block text-center text-xs text-ink/50 hover:text-track">Lihat panduan langkah demi langkah</Link>
          </>
        )}
      </div>
    </section>
  );
}
