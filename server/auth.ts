/**
 * ============================================================
 * AUTH.TS — Login + sesi token + ganti password
 * ============================================================
 * Port dari Auth.ts (Apps Script). Sesi memakai tabel `sessions`
 * di Postgres dengan token acak 32-byte (hex). Password tetap
 * plaintext (paritas dengan versi Apps Script; perbaikan auth
 * di-defer / "pikirkan nanti").
 * ============================================================
 */

import { getSheet_, sheetToObjects_, getSupabase, safeSha256 } from './sheets';
import { SHEET_USERS } from './constants';
import { SESSION_TTL_MS } from './constants';
import { randomBytes } from 'node:crypto';

export interface UserInfo {
  username: string;
  nama: string;
  cabang: string;
  role: string;
}

export function login(username: string, password: string): any {
  const users = sheetToObjects_(getSheet_(SHEET_USERS));
  const found = users.find(u =>
    String(u['Username']).trim().toLowerCase() === String(username).trim().toLowerCase() &&
    String(u['Password']) === String(password)
  );
  if (!found) return { success: false, message: 'Username atau password salah.' };

  const alamatSheet = getSheet_('ALAMAT');
  const alamatData = sheetToObjects_(alamatSheet);
  const alamat = alamatData.find(a =>
    String(a['SITE']).trim().toUpperCase() === String(found['Cabang']).trim().toUpperCase()
  );

  const token = randomBytes(32).toString('hex');

  return {
    success: true,
    token,
    username: found['Username'],
    nama: found['Nama'] || found['Username'],
    cabang: found['Cabang'],
    role: found['Role'],
    pengirim: alamat ? (alamat['PENGIRIM'] || '') : '',
    alamatLengkap: alamat ? {
      site: alamat['SITE'] || '',
      wilayah: alamat['WILAYAH'] || '',
      pic: alamat['PIC'] || '',
      dept: alamat['DEPT'] || '',
      alamat: alamat['ALAMAT'] || '',
      kelurahan: alamat['KELURAHAN'] || '',
      kecamatan: alamat['KECAMATAN'] || '',
      kota: alamat['KOTA'] || '',
      tlp: alamat['TLP'] || '',
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

  const user = await getUserByUsername(data.username);
  return user;
}

export async function getUserByUsername(username: string): Promise<UserInfo | null> {
  const users = sheetToObjects_(getSheet_(SHEET_USERS));
  const found = users.find(u =>
    String(u['Username']).trim().toLowerCase() === String(username).trim().toLowerCase()
  );
  if (!found) return null;
  return {
    username: found['Username'],
    nama: found['Nama'] || found['Username'],
    cabang: found['Cabang'],
    role: found['Role'],
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
export function gantiPassword(payload: any): any {
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

  const sheet = getSheet_(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameCol = headers.indexOf('Username');
  const passwordCol = headers.indexOf('Password');
  if (usernameCol === -1 || passwordCol === -1) {
    return { success: false, message: 'Kolom Username/Password tidak ditemukan di sheet USERS.' };
  }

  const targetUsername = String(payload.username).trim().toLowerCase();
  let rowIdx = -1;
  let passwordSaatIni = '';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][usernameCol] || '').trim().toLowerCase() === targetUsername) {
      rowIdx = i + 1;
      passwordSaatIni = data[i][passwordCol] || '';
      break;
    }
  }
  if (rowIdx === -1) {
    return { success: false, message: 'Username tidak ditemukan.' };
  }
  if (String(passwordSaatIni) !== String(payload.passwordLama)) {
    return { success: false, message: 'Password lama salah.' };
  }

  sheet.getRange(rowIdx, passwordCol + 1).setValue(String(payload.passwordBaru));
  return { success: true };
}