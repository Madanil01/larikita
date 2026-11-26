'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from './Icon';

export default function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function run() {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/sync', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg(j.error || 'Gagal sinkron');
    else {
      setMsg(j.count ? `${j.count} aktivitas diperbarui` : 'Sudah terbaru');
      router.refresh();
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button onClick={run} disabled={busy} className="btn-ghost">
        <Icon name="refresh" className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Memuat…' : 'Muat ulang'}
      </button>
      {msg && <span className="text-xs text-ink/50">{msg}</span>}
    </span>
  );
}
