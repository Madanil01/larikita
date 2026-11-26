'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from './Icon';
import { toast } from './Toaster';

export default function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const res = await fetch('/api/sync', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) toast(j.error || 'Gagal sinkron dengan Strava.', 'error');
    else {
      toast(j.count ? `${j.count} aktivitas diperbarui dari Strava.` : 'Data Strava sudah yang terbaru.');
      router.refresh();
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button onClick={run} disabled={busy} className="btn-ghost">
        <Icon name="refresh" className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Memuat…' : 'Muat ulang'}
      </button>
    </span>
  );
}
