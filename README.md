# LariKita: rencana latihan lari (5K, 10K, HM, FM) + sync Strava

LariKita membuat program latihan 5K, 10K, half marathon, atau full marathon dari tanggal lomba dan target waktu, lalu mencocokkan setiap lari di Strava dengan jadwal.

Fitur:
- **Multi-user.** Daftar dengan email + password, lalu hubungkan Strava dari halaman Pengaturan. Tiap user boleh memakai aplikasi Strava API miliknya sendiri (Client ID/Secret), jadi tidak terkena batas kuota atlet satu aplikasi.
- **Rencana otomatis.** Program dibagi 4 fase (Base, Build, Spesifik, Taper). Volume naik maksimal 10% per minggu, dengan minggu ringan setiap 4 minggu. Target tes 10K dan HM dihitung dengan rumus Riegel.
- **Dashboard.** Berisi grafik volume aktual vs rencana, kepatuhan sesi, progres per fase, checkpoint, dan analisis harian. Analisisnya berbasis aturan, jadi tidak perlu API AI berbayar.
- **Sync Strava ada 3 cara:**
  - Webhook: lari baru masuk otomatis beberapa detik setelah upload.
  - Tombol "Muat ulang".
  - Cron harian sebagai cadangan.

Stack yang dipakai: Next.js 14 (App Router), Postgres, Tailwind, dan Recharts.

---

## Deploy gratis (± 20 menit)

Semua layanan di bawah ini punya paket gratis tanpa kartu kredit:

| Bagian | Layanan | Paket gratis |
|---|---|---|
| Hosting web + API | **Vercel Hobby** | Cron hanya 1x/hari (cukup, karena sync utama lewat webhook). Khusus pemakaian non-komersial. |
| Database | **Neon Postgres Free** | Storage 1 GB per project, cukup untuk ratusan pelari. Database tidur saat tidak dipakai. |
| Kode | **GitHub** | Repo private boleh. |
| Data lari | **Strava API** | Lihat catatan *athlete capacity* di bawah. |

### 1. Buat database di Neon
1. Daftar di https://neon.com, lalu buat project. Pilih region **AWS Singapore** supaya dekat dengan Indonesia.
2. Buka **SQL Editor**, tempel seluruh isi `schema.sql`, lalu klik **Run**.
3. Buka **Connect** dan salin *connection string* (`postgresql://...sslmode=require`). Ini nilai `DATABASE_URL`.

### 2. Upload kode ke GitHub
```bash
git init && git add . && git commit -m "LariKita"
git branch -M main
git remote add origin https://github.com/USERNAME/larikita.git
git push -u origin main
```

### 3. Deploy di Vercel
1. Daftar di https://vercel.com dengan akun GitHub, klik **Add New → Project**, lalu import repo `larikita`.
2. Sebelum klik Deploy, buka **Environment Variables** dan isi semua variabel dari `.env.example`:
   - `DATABASE_URL`: dari Neon
   - `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`: diisi di langkah 4 (sementara boleh diisi asal dulu)
   - `APP_URL`: `https://nama-project.vercel.app` (bisa disesuaikan setelah deploy pertama)
   - `SESSION_SECRET`, `CRON_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`: isi dengan string acak. Bisa dibuat dengan `openssl rand -hex 32`, atau https://generate-secret.vercel.app/32
   - `DEFAULT_TZ`: `Asia/Jakarta`
3. Klik **Deploy** dan catat domainnya, misalnya `larikita.vercel.app`.

### 4. Buat aplikasi Strava API
1. Buka https://www.strava.com/settings/api.
2. Isi nama aplikasi, kategori *Training*, dan website `https://larikita.vercel.app`.
3. **Authorization Callback Domain** diisi `larikita.vercel.app`: domain saja, tanpa `https://` dan tanpa path.
4. Salin **Client ID** dan **Client Secret** ke Environment Variables di Vercel.
5. Di Vercel, buka **Deployments → ⋯ → Redeploy** supaya variabel baru terbaca.

### 5. Aktifkan webhook Strava (sekali saja)
Jalankan perintah ini di terminal, ganti nilainya dengan milik Anda:
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=CLIENT_ID \
  -F client_secret=CLIENT_SECRET \
  -F callback_url=https://larikita.vercel.app/api/strava/webhook \
  -F verify_token=NILAI_STRAVA_WEBHOOK_VERIFY_TOKEN
```
Kalau berhasil, balasannya `{"id": 12345}`. Setelah itu setiap lari baru otomatis masuk ke aplikasi. Satu langganan webhook berlaku untuk semua user.

### 6. Selesai
Buka `https://larikita.vercel.app`, klik **Connect with Strava**, lalu isi rencana latihan.

Cron di `vercel.json` berjalan setiap hari sekitar jam 04.00 WIB untuk menyinkronkan user yang belum ter-update 12 jam terakhir.

---

## ⚠️ Penting: batas jumlah user dari Strava

Setiap aplikasi Strava baru hanya bisa dipakai **1 atlet**, yaitu pemilik aplikasinya sendiri (*Single Player Mode*). Batas ini bisa dinaikkan:
- **Sampai 10 atlet:** naikkan sendiri (*self-service*) dari halaman API Settings Strava. Cocok untuk Anda dan teman-teman klub.
- **Lebih dari 10 atlet:** ajukan review ke Strava melalui formulir Developer Program. Prosesnya bisa memakan waktu berminggu-minggu. Aplikasi yang memakai webhook (seperti aplikasi ini) lebih mudah disetujui.

Kalau kuota sudah penuh, user baru akan melihat pesan "Kuota atlet aplikasi Strava ini sudah penuh" di halaman login.

**Base URL API baru.** Strava memindahkan base URL API ke `https://api-v3.strava.com` mulai **4 Januari 2027**. Setelah tanggal itu, cukup ubah env `STRAVA_API_BASE` di Vercel lalu redeploy. Kode tidak perlu diubah.

---

## Jalankan di komputer sendiri
```bash
npm install
cp .env.example .env.local     # isi DATABASE_URL (boleh pakai Neon yang sama), dll.
npm run db:setup               # buat tabel (kalau belum dijalankan di Neon SQL Editor)
npm run dev                    # buka http://localhost:3000
```
Untuk tes lokal, buat aplikasi Strava kedua dengan Callback Domain `localhost` dan `APP_URL=http://localhost:3000`. Webhook tidak bisa menjangkau localhost, jadi pakai tombol "Muat ulang".

## Struktur kode
```
app/
  page.tsx                  halaman login (Connect with Strava)
  (app)/dashboard           dashboard utama
  (app)/jadwal              jadwal per minggu + status sesi
  (app)/rencana             form rencana (server action -> generate sesi)
  api/auth/*                OAuth Strava + sesi cookie (JWT)
  api/sync                  tombol "Muat ulang"
  api/analysis              analisis harian
  api/strava/webhook        event aktivitas baru/ubah/hapus + cabut akses
  api/cron/sync             cadangan harian
lib/
  plan.ts                   generator program latihan (ubah di sini untuk menyesuaikan metode latihan)
  stats.ts                  pencocokan lari ↔ sesi, volume mingguan, kepatuhan
  analysis.ts               teks analisis harian
  strava.ts                 API Strava + refresh token otomatis
schema.sql                  struktur database
```

## Aturan pencocokan
- Sesi dianggap **selesai** kalau ada lari (Run/TrailRun/VirtualRun) pada tanggal itu dengan jarak minimal 50% rencana (atau ≥ 3 km). Lari yang digeser ±1 hari ke hari tanpa jadwal juga dihitung.
- Sesi yang lewat tanggal tanpa lari dihitung **terlewat**.
- Saat rencana dibuat ulang, semua sesi diganti, tapi data Strava tetap ada dan dicocokkan ulang.

## Privasi
- Token Strava disimpan di database Anda sendiri.
- Kalau user mencabut akses dari pengaturan Strava, webhook menghapus semua datanya otomatis.
- Sesuai ketentuan Strava, tampilkan "Powered by Strava" (sudah ada di footer) dan jangan bagikan data user ke pihak lain.
