'use client';
import { useState } from 'react';
import Icon from './Icon';
import { toast } from './Toaster';

export default function AnalysisCard({ dateLabel, initial }: { dateLabel: string; initial: string | null }) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const res = await fetch('/api/analysis', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) toast(j.error || 'Gagal membuat analisis.', 'error');
    else { setBody(j.body); toast('Analisis hari ini diperbarui.'); }
  }
  return (
    <section className="card border-l-4 border-l-volt">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Catatan latihan hari ini</h2>
          <p className="text-xs text-ink/45">{dateLabel} · dibandingkan dengan rencana</p>
        </div>
        <button onClick={run} disabled={busy} className="btn-ghost">
          <Icon name="refresh" className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Menganalisis…' : body ? 'Perbarui' : 'Buat analisis'}
        </button>
      </div>
      <div className="mt-3 max-w-3xl space-y-1.5 text-sm leading-relaxed text-ink/80">
        {body ? body.split('\n').map((l, i) => l.startsWith('## ')
          // subjudul per rencana (kalau ada lebih dari satu rencana aktif)
          ? <p key={i} className={`font-display font-semibold text-ink ${i ? 'pt-3' : ''}`}>{l.slice(3)}</p>
          : <p key={i}>{l}</p>)
          : <p className="text-ink/50">Belum ada catatan. Klik “Buat analisis” untuk menilai latihanmu hari ini dibanding rencana, berdasarkan data Strava.</p>}
      </div>
    </section>
  );
}
