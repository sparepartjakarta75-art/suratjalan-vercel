/**
 * ============================================================
 * AUTH.TS — Login + sesi token + ganti password
 * ============================================================
 * Port dari Auth.ts (Apps Script). Sesi memakai tabel `sessions`
 * di Postgres dengan token acak 32-byte (hex). Data user dibaca
 * langsung dari tabel `users`; detail alamat dari tabel `alamat`.
 * Password tetap plaintext (paritas dengan versi Apps Script;
 * perbaikan auth di-defer / "pikirkan nanti").
 * ============================================================
 */

import { getSupabase, safeSha256 } from './sheets.js';
import { SESSION_TTL_MS } from './constants.js';
import { randomBytes } from 'node:crypto';

export interface UserInfo {
  username: string;
  nama: string;
  cabang: string;
  role: string;
}

export async function login(username: string, password: string): Promise<any> {
  const db = getSupabase();
  const { data: users, error } = await db.from('users').select('*');
  if (error) throw new Error('Gagal membaca user: ' + error.message);

  const found = (users || []).find(u =>
    String(u.username).trim().toLowerCase() === String(username).trim().toLowerCase() &&
    String(u.password) === String(password)
  );
  if (!found) return { success: false, message: 'Username atau password salah.' };

  const { data: alamatData, error: aErr } = await db.from('alamat').select('*');
  if (aErr) throw new Error('Gagal membaca alamat: ' + aErr.message);
  const alamat = (alamatData || []).find(a =>
    String(a.site).trim().toUpperCase() === String(found.cabang).trim().toUpperCase()
  );

  const token = randomBytes(32).toString('hex');

  return {
    success: true,
    token,
    username: found.username,
    nama: found.nama || found.username,
    cabang: found.cabang,
    role: found.role,
    pengirim: alamat ? (alamat.pengirim || '') : '',
    alamatLengkap: alamat ? {
      site: alamat.site || '',
      wilayah: alamat.wilayah || '',
      pic: alamat.pic || '',
      dept: alamat.dept || '',
      alamat: alamat.alamat || '',
      kelurahan: alamat.kelurahan || '',
      kecamatan: alamat.kecamatan || '',
      kota: alamat.kota || '',
      tlp: alamat.tlp || '',
    } : null,
  };
}

export async function createSession(token: string, username: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('sessions').insert({
    token: safeSha256('sj-session:' + token),
    username,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  if (error) throw new Error('Gagal membuat sesi: ' + error.message);
}

export async function validateSession(token: string): Promise<UserInfo | null> {
  if (!token) return null;
  const db = getSupabase();
  const hashed = safeSha256('sj-session:' + token);
  const { data, error } = await db
    .from('sessions')
    .select('username, expires_at')
    .eq('token', hashed)
    .maybeSingle();
  if (error || !data) return null;

  const expires = new Date(data.expires_at);
  if (expires.getTime() < Date.now()) {
    await db.from('sessions').delete().eq('token', hashed);
    return null;
  }

  return await getUserByUsername(data.username);
}

export async function getUserByUsername(username: string): Promise<UserInfo | null> {
  const db = getSupabase();
  const { data: users, error } = await db.from('users').select('*');
  if (error) return null;

  const found = (users || []).find(u =>
    String(u.username).trim().toLowerCase() === String(username).trim().toLowerCase()
  );
  if (!found) return null;
  return {
    username: found.username,
    nama: found.nama || found.username,
    cabang: found.cabang,
    role: found.role,
  };
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const db = getSupabase();
  const hashed = safeSha256('sj-session:' + token);
  await db.from('sessions').delete().eq('token', hashed);
}

/**
 * Ganti password login.
 * payload: { username, passwordLama, passwordBaru }
 */
export async function gantiPassword(payload: any): Promise<any> {
  if (!payload || !payload.username || !payload.username.trim()) {
    return { success: false, message: 'Username tidak valid.' };
  }
  if (!payload.passwordLama) {
    return { success: false, message: 'Password lama wajib diisi.' };
  }
  if (!payload.passwordBaru || String(payload.passwordBaru).length < 4) {
    return { success: false, message: 'Password baru minimal 4 karakter.' };
  }
  if (String(payload.passwordBaru) === String(payload.passwordLama)) {
    return { success: false, message: 'Password baru tidak boleh sama dengan password lama.' };
  }

  const db = getSupabase();
  const { data: users, error } = await db.from('users').select('username, password');
  if (error) throw new Error('Gagal membaca user: ' + error.message);

  const targetUsername = String(payload.username).trim().toLowerCase();
  const found = (users || []).find(u =>
    String(u.username).trim().toLowerCase() === targetUsername
  );
  if (!found) return { success: false, message: 'Username tidak ditemukan.' };
  if (String(found.password) !== String(payload.passwordLama)) {
    return { success: false, message: 'Password lama salah.' };
  }

  const { error: updError } = await db
    .from('users')
    .update({ password: String(payload.passwordBaru) })
    .eq('username', found.username);
  if (updError) throw new Error('Gagal mengganti password: ' + updError.message);

  return { success: true };
}