import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { appUrl, webhookUrl } from '@/lib/strava';
import { MAX_PLANS, RUN_TYPES, STRENGTH_TYPES } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TOC = [
  ['mulai', 'Mulai cepat'],
  ['strava', 'Menghubungkan Strava'],
  ['masalah', 'Kalau koneksi gagal'],
  ['rencana', 'Rencana latihan'],
  ['jadwal', 'Jadwal & pencocokan lari'],
  ['manual', 'Mengubah jadwal sendiri'],
  ['ringkasan', 'Halaman Ringkasan'],
  ['sinkron', 'Sinkronisasi data'],
  ['faq', 'Pertanyaan umum'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 space-y-3 text-sm leading-relaxed text-ink/75">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-track/10 text-xs font-semibold text-track">{i + 1}</span>
          <div className="min-w-0 pt-0.5">{it}</div>
        </li>
      ))}
    </ol>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="break-all rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[13px] text-ink">{children}</code>
);
const Note = ({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) => (
  <p className={`rounded-xl px-3.5 py-2.5 text-[13px] ${tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-paper text-ink/65'}`}>{children}</p>
);

export default async function Panduan() {
  await requireUser();
  const url = appUrl();
  const domain = new URL(url).hostname;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Panduan</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/55">
          Cara menghubungkan Strava dan memakai semua fitur LariKita, dari membuat rencana sampai membaca progres latihan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="lg:sticky lg:top-8 lg:self-start" aria-label="Daftar isi">
          <p className="label">Daftar isi</p>
          <ul className="flex gap-1.5 overflow-x-auto pb-1 text-sm lg:flex-col lg:gap-0.5">
            {TOC.map(([id, t]) => (
              <li key={id} className="shrink-0">
                <a href={`#${id}`} className="block rounded-lg px-2.5 py-1.5 text-ink/60 hover:bg-ink/[0.04] hover:text-ink">{t}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <Section id="mulai" title="Mulai cepat">
            <Steps items={[
              <><b>Hubungkan Strava</b> (opsional tapi disarankan) supaya lari tercentang otomatis. Langkahnya di bagian berikut.</>,
              <><b>Buat rencana</b> di menu <Link href="/rencana" className="text-track underline">Rencana</Link>: isi lomba, tanggal, target waktu, dan hari lari.</>,
              <><b>Lari seperti biasa</b> dan rekam dengan Strava. Tanpa Strava, catat manual di Jadwal.</>,
              <><b>Pantau progres</b> di <Link href="/dashboard" className="text-track underline">Ringkasan</Link>: sisa hari, sesi berikutnya, volume, dan kepatuhan.</>,
            ]} />
          </Section>

          <Section id="strava" title="Menghubungkan Strava">
            <p>
              LariKita hanya <b>membaca</b> aktivitasmu. Kami tidak pernah memposting, mengubah, atau menghapus apa pun di Strava.
            </p>
            <Note>
              Kenapa harus membuat “aplikasi Strava” sendiri? Strava membatasi setiap aplikasi ke sedikit atlet (aplikasi baru hanya
              untuk pemiliknya). Dengan aplikasi milikmu sendiri, kamu tidak berebut kuota dengan pengguna lain. Gratis dan cukup sekali.
            </Note>

            <h3 className="pt-2 font-semibold text-ink">A. Buat aplikasi Strava (sekali saja)</h3>
            <Steps items={[
              <>Login ke Strava di browser, lalu buka <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer" className="text-track underline">strava.com/settings/api</a>. Pakai akun Strava yang sama dengan yang akan kamu hubungkan.</>,
              <>Isi formulirnya:
                <ul className="mt-2 space-y-1.5 text-[13px]">
                  <li><span className="text-ink/50">Application Name:</span> bebas, misalnya <Code>LariKita Budi</Code></li>
                  <li><span className="text-ink/50">Category:</span> <Code>Training</Code></li>
                  <li><span className="text-ink/50">Website:</span> <Code>{url}</Code></li>
                  <li><span className="text-ink/50">Authorization Callback Domain:</span> <Code>{domain}</Code> <span className="text-ink/45">(domain saja, tanpa https:// dan tanpa garis miring)</span></li>
                </ul>
              </>,
              <>Setujui syaratnya dan simpan. Kalau Strava meminta <b>ikon aplikasi</b>, unggah gambar apa saja.</>,
              <>Di halaman itu akan muncul <b>Client ID</b> (angka) dan <b>Client Secret</b> (klik “show” untuk melihatnya). Biarkan tab ini terbuka.</>,
            ]} />

            <h3 className="pt-2 font-semibold text-ink">B. Simpan di LariKita</h3>
            <Steps items={[
              <>Buka <Link href="/pengaturan" className="text-track underline">Pengaturan</Link>, bagian <b>1. Aplikasi Strava</b>.</>,
              <>Tempel <b>Client ID</b> dan <b>Client Secret</b>, lalu klik <b>Simpan</b>. Secret disimpan terenkripsi.</>,
            ]} />

            <h3 className="pt-2 font-semibold text-ink">C. Sambungkan akun</h3>
            <Steps items={[
              <>Di bagian <b>2. Koneksi Strava</b>, klik tombol oranye <b>Connect with Strava</b>.</>,
              <>Di halaman izin Strava, <b>biarkan semua kotak tercentang</b>, terutama “View data about your activities”. Tanpa izin ini lari tidak bisa dibaca. Lalu klik <b>Authorize</b>.</>,
              <>Kamu kembali ke Pengaturan. Aktivitas 6 bulan terakhir langsung disinkronkan. Status dan jumlah aktivitas bisa dilihat di kartu <b>Akun terhubung</b> di Ringkasan.</>,
            ]} />

            <h3 className="pt-2 font-semibold text-ink">D. Aktifkan sync otomatis (disarankan)</h3>
            <p>
              Di bagian <b>3. Sync otomatis (webhook)</b> klik <b>Aktifkan webhook</b>. Setelah itu lari baru masuk beberapa detik setelah
              kamu upload ke Strava, tanpa perlu menekan apa pun. Webhook dikirim ke <Code>{webhookUrl()}</Code>.
            </p>
            {(domain === 'localhost' || domain === '127.0.0.1') && (
              <Note tone="warn">Aplikasi ini sedang berjalan di localhost. Webhook butuh alamat publik, jadi pakai tombol “Muat ulang” saja.</Note>
            )}

            <h3 className="pt-2 font-semibold text-ink">Memutuskan koneksi</h3>
            <p>
              Di Pengaturan, klik <b>Putuskan Strava &amp; hapus data aktivitas</b>. Akses LariKita dicabut dan aktivitas dari Strava
              dihapus dari LariKita. Rencana dan catatan manualmu tetap ada.
            </p>
          </Section>

          <Section id="masalah" title="Kalau koneksi gagal">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead className="text-xs text-ink/45">
                  <tr><th className="py-2 pr-4 font-medium">Pesan yang muncul</th><th className="py-2 font-medium">Yang perlu dilakukan</th></tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06] align-top">
                  {[
                    ['Strava menampilkan “Bad Request · redirect_uri invalid”', <>Authorization Callback Domain di Strava belum <Code>{domain}</Code>. Betulkan di strava.com/settings/api.</>],
                    ['Centang izin “lihat aktivitas”…', 'Kamu tidak mencentang izin aktivitas. Klik Connect with Strava lagi dan biarkan semua kotak tercentang.'],
                    ['Kuota atlet aplikasi Strava-mu penuh', 'Aplikasi Strava itu dibuat dengan akun lain. Buat aplikasi dengan akun Strava yang sama dengan yang kamu hubungkan.'],
                    ['Kuota atlet aplikasi Strava bersama sudah penuh', 'Aplikasi bawaan server sudah penuh. Buat aplikasi Strava sendiri (langkah A dan B).'],
                    ['Gagal menghubungkan Strava. Cek Client ID / Secret.', 'Salin ulang Client ID dan Client Secret dari Strava. Pastikan tidak ada spasi yang ikut tersalin.'],
                    ['Client Secret tidak bisa dibaca', 'Kunci server berubah. Isi ulang Client Secret di Pengaturan.'],
                    ['Akun Strava ini sudah terhubung ke akun LariKita lain', 'Satu akun Strava hanya untuk satu akun LariKita. Putuskan dulu dari akun yang lama.'],
                    ['Sesi koneksi kedaluwarsa', 'Proses izin lebih dari 10 menit. Ulangi dari tombol Connect with Strava.'],
                    ['Batas request Strava tercapai', 'Strava membatasi jumlah permintaan. Tunggu sekitar 15 menit lalu coba Muat ulang.'],
                  ].map(([m, fix], i) => (
                    <tr key={i}><td className="py-2.5 pr-4 font-medium text-ink">{m}</td><td className="py-2.5 text-ink/65">{fix}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="rencana" title="Rencana latihan">
            <p>Rencana menyusun jadwal dari hari ini sampai hari lomba. Yang perlu diisi:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Lomba:</b> nama, kategori (5K, 10K, Half, Full Marathon), tanggal, dan target waktu. Fun run biasanya pilih 5K.</li>
              <li><b>Hari lari:</b> pilih 3–6 hari dan hari untuk long run. Sesi berat otomatis diberi jeda supaya tidak berurutan.</li>
              <li><b>Strength:</b> 0–3x per minggu, diselipkan di hari kosong.</li>
              <li><b>Volume saat ini:</b> rata-rata km per minggu belakangan ini. Volume naik maksimal 10% per minggu.</li>
              <li><b>Lomba/tes terbaru (opsional):</b> untuk menentukan pace awal. Kalau kosong, diperkirakan dari data Strava.</li>
              <li><b>Push (opsional):</b> mempercepat tempo, interval, dan sesi pace lomba sekian persen.</li>
            </ul>
            <p>
              Program dibagi 4 fase: <b>Base</b> → <b>Build</b> → <b>Spesifik</b> → <b>Taper</b>. Di tengahnya ada tes 5K/10K sebagai
              checkpoint.
            </p>
            <h3 className="pt-2 font-semibold text-ink">Tingkat risiko</h3>
            <p>
              Lama program tidak dibatasi: kamu boleh membuat rencana 2 minggu sebelum lomba atau setahun sebelumnya. Sebagai gantinya,
              LariKita menilai <b>tingkat risiko</b> (Rendah, Sedang, Tinggi, Sangat tinggi). Lama program langsung terlihat di form
              saat kamu mengisi tanggal. Penilaian lengkapnya muncul di kartu rencana dan di halaman Ubah rencana. Yang dinilai:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Lama program</b> dibanding yang disarankan: minimal 4/6/8/10 minggu dan ideal 8/10/12/16 minggu untuk 5K/10K/HM/FM. Program lebih dari 40 minggu juga diberi catatan karena rawan jenuh.</li>
              <li><b>Target dibanding kemampuanmu sekarang</b> (dari lomba terbaru atau data Strava).</li>
              <li><b>Push</b> di atas 10%, atau push yang ikut mempercepat easy &amp; long run.</li>
              <li><b>Long run terpanjang</b> yang belum cukup untuk jarak lombanya.</li>
            </ul>
            <p>Risiko tinggi bukan larangan. Itu tanda untuk menurunkan target, menambah waktu persiapan, atau mendengarkan badan lebih teliti.</p>
            <h3 className="pt-2 font-semibold text-ink">Beberapa rencana sekaligus</h3>
            <p>
              Kamu bisa punya sampai <b>{MAX_PLANS} rencana</b>, misalnya 10K bulan Maret sambil persiapan Half Marathon bulan Juni.
              Klik <b>+ Rencana baru</b> di halaman Rencana. Di Ringkasan dan Jadwal, pilih rencana lewat chip di bagian atas.
            </p>
            <Note tone="warn">
              Setiap rencana dihitung terpisah. Kalau masa latihannya bertumpuk, kartu rencana diberi tanda “Bertumpuk dengan …”. Jaga
              total km mingguan supaya tidak berlebihan, dan ingat satu lari bisa mencentang sesi di dua rencana.
            </Note>
          </Section>

          <Section id="jadwal" title="Jadwal & pencocokan lari">
            <p>Jadwal menampilkan semua sesi per minggu. Minggu ini diberi bingkai hijau. Status setiap sesi:</p>
            <ul className="space-y-1.5">
              <li><span className="chip mr-2 bg-ok/10 text-ok">Selesai</span>ada lari yang cocok, lengkap dengan jarak dan pace aslinya</li>
              <li><span className="chip mr-2 bg-bad/10 text-bad">Terlewat</span>tanggalnya sudah lewat dan tidak ada lari yang cocok</li>
              <li><span className="chip mr-2 bg-warn/10 text-warn">Hari ini</span>jadwal hari ini yang belum dilakukan</li>
            </ul>
            <h3 className="pt-2 font-semibold text-ink">Aturan pencocokan</h3>
            <Steps items={[
              <>Lari di <b>tanggal yang sama</b> dengan sesinya langsung dicocokkan.</>,
              <>Lari yang <b>beda sehari</b> masuk ke <b>sesi kemarin</b> dulu (latihan yang telat). Kalau sesi kemarin sudah selesai, masuk ke <b>sesi besok</b> (latihan yang dimajukan).</>,
              <>Lari dihitung kalau jaraknya minimal <b>50% dari rencana atau 3 km</b>. Jenis yang dihitung: {RUN_TYPES.join(', ')}.</>,
              <>Sesi strength tercentang oleh aktivitas Strava jenis {STRENGTH_TYPES.join(', ')}. Strength yang tidak tercatat tampil netral, bukan “Terlewat”.</>,
            ]} />
            <h3 className="pt-2 font-semibold text-ink">Catat lari manual</h3>
            <p>
              Lupa merekam, lari di treadmill tanpa jam, atau tidak pakai Strava? Klik <b>+ Catat lari</b> di atas Jadwal, atau tombol
              <b> Catat</b> di sesi yang sudah lewat. Isi jarak dan durasi, misalnya <Code>32:15</Code>. Catatan manual ikut dihitung
              seperti lari dari Strava dan bisa dihapus kapan saja (maksimal 90 hari ke belakang).
            </p>
          </Section>

          <Section id="manual" title="Mengubah jadwal sendiri">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Ubah</b> di setiap sesi: ganti tanggal, jenis, jarak, pace, judul, atau catatan. Ada juga tombol <b>Hapus sesi ini</b>.</li>
              <li><b>+ Tambah sesi</b> di bawah setiap minggu untuk menambah sesi sendiri.</li>
              <li>Sesi yang kamu ubah atau tambah diberi label <span className="chip bg-info/10 text-info">diubah</span>.</li>
            </ul>
            <h3 className="pt-2 font-semibold text-ink">Saat mengubah rencana</h3>
            <p>Tombol <b>Simpan perubahan</b> di halaman Ubah rencana membuka popup dengan tiga pilihan:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Batal</b>: kembali ke form, tidak ada yang disimpan.</li>
              <li><b>Simpan detail saja</b>: hanya nama lomba, judul target, dan zona waktu yang disimpan. Jadwal dan sesi “diubah” tetap utuh.</li>
              <li><b>Buat ulang jadwal / Timpa perubahan</b>: jadwal disusun ulang dari awal. <b>Semua sesi yang kamu ubah manual hilang.</b> Catatan lari manual tetap ada, tapi dicocokkan ulang ke jadwal baru.</li>
            </ul>
          </Section>

          <Section id="ringkasan" title="Halaman Ringkasan">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Kartu hitung mundur:</b> sisa hari ke lomba, sesi berikutnya, dan posisimu di program per fase (penanda oranye = minggu ini).</li>
              <li><b>Minggu ini:</b> km yang sudah dijalani dibanding rencana minggu ini.</li>
              <li><b>Kepatuhan:</b> persentase sesi lari yang selesai.</li>
              <li><b>Checkpoint berikutnya:</b> tes atau lomba terdekat.</li>
              <li><b>Catatan latihan hari ini:</b> klik <b>Buat analisis</b> untuk penilaian latihan hari ini dibanding rencana, plus tren 7 hari. Kalau punya beberapa rencana aktif, semuanya dibahas.</li>
              <li><b>Volume mingguan:</b> grafik km aktual (hijau) dan rencana (putus-putus).</li>
              <li><b>Progres per fase</b> dan daftar <b>Checkpoint</b> beserta hasilnya.</li>
              <li><b>Akun terhubung:</b> akun LariKita dan Strava, ID atlet, kapan terakhir sinkron, jumlah aktivitas, dan mode sinkron.</li>
            </ul>
          </Section>

          <Section id="sinkron" title="Sinkronisasi data">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Webhook (otomatis):</b> lari baru masuk beberapa detik setelah upload ke Strava. Aktifkan di Pengaturan.</li>
              <li><b>Muat ulang:</b> tombol di kartu Akun terhubung dan di Jadwal, untuk menarik aktivitas terbaru saat itu juga.</li>
              <li><b>Sync harian:</b> setiap hari sekitar jam 04.00 WIB sebagai cadangan kalau webhook terlewat.</li>
            </ul>
            <Note>
              Aktivitas yang kamu ubah atau hapus di Strava ikut diperbarui di LariKita saat sinkron berikutnya.
            </Note>
          </Section>

          <Section id="faq" title="Pertanyaan umum">
            <dl className="space-y-4">
              {[
                ['Lariku sudah di Strava tapi sesi belum tercentang.', 'Klik Muat ulang. Kalau masih belum, cek jaraknya (minimal 50% rencana atau 3 km), jenis aktivitasnya (harus Run, Trail Run, atau Virtual Run), dan tanggalnya (maksimal beda sehari dari jadwal).'],
                ['Apakah LariKita bisa melihat data pribadiku?', 'Hanya aktivitas olahraga: tanggal, jenis, jarak, durasi, dan detak jantung rata-rata. LariKita tidak mengakses pesan, foto, atau data sosialmu, dan tidak pernah menulis ke Strava.'],
                ['Bisa dipakai tanpa Strava?', 'Bisa. Semua fitur jalan dengan catatan lari manual di halaman Jadwal.'],
                ['Aku sakit seminggu. Jadwalnya bagaimana?', 'Sesi yang lewat akan tercatat “Terlewat”. Lanjutkan dari jadwal hari ini, jangan dikejar. Kalau jedanya panjang, ubah rencana dan buat ulang jadwal dengan volume saat ini yang lebih rendah.'],
                ['Ganti HP atau jam lari?', 'Tidak masalah. Selama aktivitas masuk ke akun Strava yang sama, LariKita tetap membacanya.'],
                ['Pace di jadwal terasa terlalu cepat atau lambat.', 'Isi “Lomba/tes terbaru” di form rencana dengan hasil terbarumu, lalu buat ulang jadwal. Pace akan dihitung ulang dari situ.'],
              ].map(([q, a]) => (
                <div key={q}>
                  <dt className="font-semibold text-ink">{q}</dt>
                  <dd className="mt-1">{a}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
