// Membuat/migrasi tabel dari schema.sql. Pakai: npm run db:setup
// Aman dijalankan berulang. DATABASE_URL dibaca dari env, .env.local, atau .env (urutan prioritas seperti Next.js).
import fs from 'node:fs';
import postgres from 'postgres';

for (const f of ['.env.local', '.env']) {
  if (fs.existsSync(f)) process.loadEnvFile(f); // tidak menimpa variabel yang sudah ada
}

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL belum di-set (cek .env / .env.local)'); process.exit(1); }
const sql = postgres(url, { ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require', onnotice: () => {} });
await sql.unsafe(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
console.log('Skema database siap. Tabel:', tables.map((t) => t.table_name).join(', '));
await sql.end();
