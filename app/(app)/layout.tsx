import { Suspense } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Logo from '@/components/Logo';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { requireUser } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const connected = !!user.access_token;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink/[0.06] bg-card/60 px-4 py-5 lg:flex">
        <Link href="/dashboard" className="px-2"><Logo /></Link>
        <div className="mt-8 flex-1"><Suspense><Nav variant="side" /></Suspense></div>
        <div className="rounded-2xl border border-ink/[0.07] bg-card p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} src={user.avatar} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-ink/50">
                <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-ok' : 'bg-warn'}`} />
                {connected ? 'Strava tersambung' : 'Strava belum'}
              </p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-ink/55 transition hover:bg-ink/[0.04] hover:text-ink">
              <Icon name="logout" className="h-4 w-4" /> Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar mobile */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/[0.06] bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/dashboard"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link href="/pengaturan" aria-label="Akun"><Avatar name={user.name} src={user.avatar} size={30} /></Link>
            <form action="/api/auth/logout" method="post">
              <button aria-label="Keluar" className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"><Icon name="logout" className="h-5 w-5" /></button>
            </form>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-10">
          {children}
          <footer className="mt-10 text-center text-[11px] text-ink/30">Data aktivitas dari Strava · Powered by Strava</footer>
        </main>
      </div>

      <Suspense><Nav variant="bottom" /></Suspense>
    </div>
  );
}
