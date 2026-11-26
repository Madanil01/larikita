'use client';
import { useRef } from 'react';

/**
 * Tombol simpan di form "Ubah rencana". Sebelum submit, tampilkan popup: membuat ulang jadwal akan menimpa
 * sesi yang sudah diubah/ditambah manual. User bisa pilih "Simpan detail saja" (jadwal tidak disentuh).
 * Dialog ada DI DALAM <form>, jadi tombol di dalamnya ikut mengirim form dengan name="mode".
 */
export default function RegenConfirm({ edited, manualLogs }: { edited: number; manualLogs: number }) {
  const btn = useRef<HTMLButtonElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const open = () => {
    if (btn.current?.form && !btn.current.form.reportValidity()) return; // isian wajib dicek dulu
    dlg.current?.showModal();
  };
  const close = () => dlg.current?.close();

  return (
    <>
      <button ref={btn} type="button" onClick={open} className="btn">Simpan perubahan</button>
      <dialog ref={dlg} aria-labelledby="regen-title"
        className="w-[min(30rem,calc(100%-2rem))] rounded-2xl border border-ink/[0.07] bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]">
        <div className="p-6">
          <h2 id="regen-title" className="font-display text-xl font-semibold">Buat ulang jadwal?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            Menyimpan perubahan rencana akan menyusun ulang <b>semua sesi</b> rencana ini dari awal.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className={`flex gap-2.5 rounded-xl px-3 py-2.5 ${edited ? 'bg-bad/10 text-bad' : 'bg-paper text-ink/60'}`}>
              <span className="font-display text-lg font-semibold leading-none">{edited}</span>
              <span>{edited ? 'sesi yang kamu ubah atau tambah manual di Jadwal akan ditimpa dan hilang.' : 'sesi yang diubah manual. Aman ditimpa.'}</span>
            </li>
            {manualLogs > 0 && (
              <li className="flex gap-2.5 rounded-xl bg-paper px-3 py-2.5 text-ink/60">
                <span className="font-display text-lg font-semibold leading-none">{manualLogs}</span>
                <span>catatan lari manual tidak hilang, tapi akan dicocokkan ulang ke jadwal baru (bisa pindah ke sesi lain).</span>
              </li>
            )}
          </ul>
          <p className="mt-4 text-xs text-ink/45">
            Cuma mengganti nama lomba, judul target, atau zona waktu? Pilih <b>Simpan detail saja</b>: jadwal tidak disentuh
            dan perubahan lain di form ini diabaikan.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/[0.06] bg-paper/50 px-6 py-4">
          <button type="button" onClick={close} className="mr-auto text-sm text-ink/50 hover:text-ink">Batal</button>
          <button name="mode" value="info" onClick={close} className="btn-ghost px-4 py-2 text-sm">Simpan detail saja</button>
          <button name="mode" value="regen" onClick={close}
            className={`btn ${edited ? 'bg-bad hover:bg-bad/90' : ''}`}>
            {edited ? `Timpa ${edited} perubahan` : 'Buat ulang jadwal'}
          </button>
        </div>
      </dialog>
    </>
  );
}
