'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

const TABS = [
  { href: '/dashboard', label: 'Ringkasan', icon: 'home' },
  { href: '/jadwal', label: 'Jadwal', icon: 'calendar' },
  { href: '/rencana', label: 'Rencana', icon: 'flag' },
  { href: '/pengaturan', label: 'Pengaturan', icon: 'settings' },
];

/** Desktop: daftar vertikal di sidebar. Mobile: tab bar menempel di bawah layar. */
export default function Nav({ variant }: { variant: 'side' | 'bottom' }) {
  const path = usePathname();
  if (variant === 'bottom') {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/[0.07] bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => {
            const on = path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
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
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
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
