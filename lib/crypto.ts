import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));

/** Hash password: "scrypt$<salt hex>$<hash hex>" */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(pw, Buffer.from(saltHex, 'hex'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Kunci enkripsi untuk Client Secret Strava milik user.
 * Pakai ENCRYPTION_KEY kalau ada; kalau tidak, diturunkan dari SESSION_SECRET.
 * Catatan: kalau kunci ini berubah, secret yang tersimpan tidak bisa dibaca lagi (user perlu isi ulang).
 */
function encKey(): Buffer {
  const base = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!base || base.length < 32) throw new Error('ENCRYPTION_KEY / SESSION_SECRET minimal 32 karakter');
  return createHash('sha256').update(`larikita-enc:${base}`).digest();
}

/** AES-256-GCM: "v1:<iv>:<tag>:<ciphertext>" (base64url) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), data].map((x) => (typeof x === 'string' ? x : x.toString('base64url'))).join(':');
}

export function decrypt(enc: string): string {
  const [v, iv, tag, data] = enc.split(':');
  if (v !== 'v1') throw new Error('Format secret tidak dikenal');
  const d = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
