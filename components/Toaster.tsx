'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Kind = 'ok' | 'error';
interface Toast { id: number; kind: Kind; msg: string; leaving?: boolean }

const EVENT = 'lk-toast';

/** Tampilkan toast dari komponen client mana saja: toast('Tersimpan') / toast('Gagal', 'error') */
export function toast(msg: string, kind: Kind = 'ok') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { msg, kind } }));
}

/**
 * Chip notifikasi melayang di kanan atas. Sumbernya:
 * - query ?ok=pesan / ?error=pesan dari redirect server action (lalu dihapus dari URL tanpa memuat ulang halaman)
 * - toast() dari komponen client
 */
export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const params = useSearchParams();

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 220);
  }, []);

  const push = useCallback((msg: string, kind: Kind) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.filter((t) => t.msg !== msg).slice(-3), { id, kind, msg }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
  }, [dismiss]);

  // Pesan dari URL
  useEffect(() => {
    const ok = params.get('ok'), error = params.get('error');
    if (!ok && !error) return;
    if (error) push(error, 'error');
    if (ok) push(ok, 'ok');
    const url = new URL(window.location.href);
    url.searchParams.delete('ok');
    url.searchParams.delete('error');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [params, push]);

  // Pesan dari toast()
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<{ msg: string; kind: Kind }>).detail; push(d.msg, d.kind); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [push]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5">
      {items.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-card py-3 pl-3 pr-2 shadow-[0_12px_32px_-12px_rgb(var(--ink)/0.3)] ${
            t.kind === 'error' ? 'border-bad/20' : 'border-ok/20'} ${t.leaving ? 'toast-out' : 'toast-in'}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.kind === 'error' ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d={t.kind === 'error' ? 'M12 7v6M12 17h.01' : 'M5 12.5l4.5 4.5L19 7.5'} />
            </svg>
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className={`text-xs font-semibold ${t.kind === 'error' ? 'text-bad' : 'text-ok'}`}>{t.kind === 'error' ? 'Gagal' : 'Berhasil'}</p>
            <p className="mt-0.5 text-sm leading-snug text-ink/80">{t.msg}</p>
          </div>
          <button onClick={() => dismiss(t.id)} aria-label="Tutup" className="rounded-full p-1 text-ink/35 hover:bg-ink/5 hover:text-ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
