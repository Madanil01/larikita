'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from './Icon';

// keepPlan: link ikut membawa ?plan= supaya rencana yang dipilih tetap sama saat pindah Ringkasan <-> Jadwal
const TABS = [
  { href: '/dashboard', label: 'Ringkasan', icon: 'home', keepPlan: true },
  { href: '/jadwal', label: 'Jadwal', icon: 'calendar', keepPlan: true },
  { href: '/rencana', label: 'Rencana', icon: 'flag' },
  { href: '/pengaturan', label: 'Pengaturan', icon: 'settings' },
  { href: '/panduan', label: 'Panduan', icon: 'book' },
];

/** Desktop: daftar vertikal di sidebar. Mobile: tab bar menempel di bawah layar. */
export default function Nav({ variant }: { variant: 'side' | 'bottom' }) {
  const path = usePathname();
  const plan = useSearchParams().get('plan');
  const href = (t: (typeof TABS)[number]) => (t.keepPlan && plan ? `${t.href}?plan=${plan}` : t.href);
  if (variant === 'bottom') {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/[0.07] bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const on = path.startsWith(t.href);
            return (
              <Link key={t.href} href={href(t)} aria-current={on ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${on ? 'text-track' : 'text-ink/45'}`}>
                <Icon name={t.icon} className="h-[22px] w-[22px]" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }
  return (
    <nav className="space-y-0.5">
      {TABS.map((t) => {
        const on = path.startsWith(t.href);
        return (
          <Link key={t.href} href={href(t)} aria-current={on ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
              on ? 'bg-ink text-paper' : 'text-ink/60 hover:bg-ink/[0.04] hover:text-ink'}`}>
            <Icon name={t.icon} className="h-[18px] w-[18px]" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
