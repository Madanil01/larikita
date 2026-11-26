import type { SessionRow } from '@/lib/db';
import { SESSION_TYPES } from '@/lib/plan';
import { deleteSession, saveSession } from '@/app/(app)/jadwal/actions';
import PendingOverlay from './PendingOverlay';

const mmss = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '');

/**
 * Form ubah sesi (session diisi) atau tambah sesi baru (session kosong, defaultDate dipakai).
 * Dibungkus <details> supaya tetap tanpa JavaScript.
 */
export default function SessionEditor({ planId, week, session, defaultDate, minDate, maxDate, trigger }: {
  planId: number; week: number; session?: SessionRow; defaultDate?: string; minDate: string; maxDate: string; trigger: React.ReactNode;
}) {
  const s = session;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none">{trigger}</summary>
      <form action={saveSession} className="mt-2 grid max-w-lg grid-cols-2 gap-2 rounded-xl border border-ink/[0.07] bg-paper/60 p-3 sm:grid-cols-4">
        <PendingOverlay label="Menyimpan sesi…" />
        <input type="hidden" name="plan" value={planId} />
        <input type="hidden" name="week" value={week} />
        {s && <input type="hidden" name="session_id" value={s.id} />}
        <label className="col-span-2 sm:col-span-1"><span className="label">Tanggal</span>
          <input name="date" type="date" required defaultValue={s?.date ?? defaultDate} min={minDate} max={maxDate} className="input px-2 py-1" /></label>
        <label><span className="label">Jenis</span>
          <select name="type" defaultValue={s?.type ?? 'easy'} className="input px-2 py-1">
            {Object.entries(SESSION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label><span className="label">Jarak (km)</span>
          <input name="km" inputMode="decimal" defaultValue={s ? s.distance_km || '' : ''} placeholder="kosong u/ strength" className="input px-2 py-1" /></label>
        <label><span className="label">Pace (opsional)</span>
          <input name="pace" defaultValue={mmss(s?.pace_sec ?? null)} placeholder="5:45" className="input px-2 py-1" /></label>
        <label className="col-span-2"><span className="label">Judul</span>
          <input name="title" maxLength={80} defaultValue={s?.title ?? ''} placeholder="mis. Easy run" className="input px-2 py-1" /></label>
        <label className="col-span-2"><span className="label">Catatan (opsional)</span>
          <input name="notes" maxLength={200} defaultValue={s?.notes ?? ''} className="input px-2 py-1" /></label>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
          <button className="btn">{s ? 'Simpan perubahan' : 'Tambah sesi'}</button>
          {s && (
            <button formAction={deleteSession} formNoValidate className="text-xs text-bad/80 underline hover:text-bad">
              Hapus sesi ini
            </button>
          )}
        </div>
      </form>
    </details>
  );
}
