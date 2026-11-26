// Semua tanggal disimpan sebagai string 'YYYY-MM-DD' (tanpa jam) supaya bebas masalah zona waktu.
const DAY = 86_400_000;

export function toMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromMs(toMs(iso) + n * DAY);
}

/** b - a dalam hari */
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY);
}

/** 0 = Senin ... 6 = Minggu */
export function weekday(iso: string): number {
  return (new Date(toMs(iso)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  }
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function fmtShort(iso: string): string {
  const d = new Date(toMs(iso));
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
}
export function fmtMedium(iso: string): string {
  const d = new Date(toMs(iso));
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fmtLong(iso: string): string {
  const d = new Date(toMs(iso));
  return `${d.getUTCDate()} ${BULAN_PANJANG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function monthLabel(iso: string): string {
  return BULAN[new Date(toMs(iso)).getUTCMonth()];
}
export function dayName(iso: string): string {
  return HARI[weekday(iso)];
}

/** detik -> "1:55:00" atau "54:30" */
export function fmtDuration(sec: number): string {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** detik per km -> "5:41/km" */
export function fmtPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !isFinite(secPerKm)) return '-';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
}

/** "3:59:00", "4:00", "59:30" -> detik */
export function parseDuration(str: string): number | null {
  const parts = str.trim().split(':').map((p) => Number(p));
  if (!parts.length || parts.some((p) => !isFinite(p) || p < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60; // "4:00" dianggap jam:menit
  return null;
}

/** Waktu stopwatch: "mm:dd", "j:mm:dd", atau angka saja = menit → detik */
export function parseClock(str: string): number | null {
  const s = str.trim();
  if (!s) return null;
  const p = s.split(':').map(Number);
  if (p.some((x) => !isFinite(x) || x < 0)) return null;
  if (p.length === 1) return Math.round(p[0] * 60);
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return null;
}
