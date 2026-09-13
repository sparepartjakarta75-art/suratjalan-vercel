/**
 * ============================================================
 * SHEETS.TS — Supabase client + utilitas
 * ============================================================
 * Versi awal memakai virtual-sheet `sheet_rows` meniru Google
 * Sheets. Sejak migration 002/004 seluruh data dipindah ke tabel
 * Postgres normal, jadi shim sheet sudah dihapus. File ini kini
 * hanya menyediakan klien Supabase + utilitas bersama.
 * ============================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'node:crypto';

let supabase: SupabaseClient | null = null;

export function initSupabase(url: string, serviceKey: string): SupabaseClient {
  supabase = createClient(url, serviceKey);
  return supabase;
}

/** Untuk pengujian lokal: ganti klien dengan mock. */
export function setSupabaseClientForTests(client: any): void {
  supabase = client;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase belum diinisialisasi (cek env SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  return supabase;
}

// ============================================================
// Utilities / Logger / Session (mirip Apps Script)
// ============================================================

const ID_BULAN_LENGKAP = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const Logger = {
  log: (msg: any) => console.log(msg),
};

export const Session = {
  getScriptTimeZone: () => 'Asia/Jakarta',
};

export const Utilities = {
  getUuid: () => randomUUID(),

  formatDate(date: string | Date, timeZone: string, fmt: string): string {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      const tz = timeZone || 'Asia/Jakarta';
      const parts: Record<string, string> = {};
      new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      })
        .formatToParts(d)
        .forEach((p) => (parts[p.type] = p.value));

      const mm = String(parts.month || '').padStart(2, '0');
      const dd = String(parts.day || '').padStart(2, '0');
      const yyyy = parts.year || '';
      const hh = parts.hour || '';
      const mi = parts.minute || '';

      return fmt
        .replace('dd/MM/yyyy HH:mm', dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi)
        .replace('dd/MM/yyyy', dd + '/' + mm + '/' + yyyy)
        .replace('yyyy-MM-dd', yyyy + '-' + mm + '-' + dd)
        .replace('MMMM', ID_BULAN_LENGKAP[(Number(mm) || 1) - 1])
        .replace('HH:mm', hh + ':' + mi);
    } catch {
      return '';
    }
  },

  base64Encode(data: Uint8Array | string): string {
    if (typeof data === 'string') return Buffer.from(data, 'binary').toString('base64');
    return Buffer.from(data).toString('base64');
  },
};

export function safeSha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}