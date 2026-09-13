/**
 * ============================================================
 * SHEETS.TS — Virtual-sheet shim
 * ============================================================
 * Meniru API Google Apps Script Spreadsheet di atas Supabase.
 * Setiap "sheet" disimpan di tabel `sheet_rows` sebagai baris
 * jsonb bernomor urut. Semua operasi berjalan sinkron di memori
 * selama satu request, lalu di-flush balik ke Postgres.
 *
 * Dengan ini logika bisnis versi Apps Script (src/server/*.ts)
 * bisa diport hampir verbatim tanpa mengubah alurnya.
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
// VIRTUAL SHEET
// ============================================================

export type Matrix = any[][];

class VirtualSheet {
  constructor(
    public name: string,
    public matrix: Matrix,
  ) {
    this.recomputeWidth();
  }

  dirty = false;
  width = 0;

  recomputeWidth() {
    let w = 0;
    for (const r of this.matrix) w = Math.max(w, r.length);
    this.width = w;
  }

  getDataRange() {
    return { getValues: () => this.snapshot() };
  }

  snapshot(): Matrix {
    this.recomputeWidth();
    for (const r of this.matrix) {
      while (r.length < this.width) r.push('');
    }
    return this.matrix;
  }

  getLastRow() {
    return this.matrix.length;
  }

  getLastColumn() {
    return this.width;
  }

  getRange(row1: number, col1: number) {
    const self = this;
    return {
      setValue(value: any) {
        self._set(row1, col1, value);
      },
    };
  }

  private _set(row1: number, col1: number, value: any) {
    while (this.matrix.length < row1) this.matrix.push([]);
    this.recomputeWidth();
    while (this.width < col1) {
      this.width++;
      for (const r of this.matrix) r.push('');
    }
    let r = this.matrix[row1 - 1];
    while (r.length < this.width) r.push('');
    r[col1 - 1] = value;
    this.dirty = true;
  }

  appendRow(arr: any[]) {
    const padded = new Array(this.width).fill('');
    arr.forEach((v, i) => (padded[i] = v));
    this.matrix.push(padded);
    this.dirty = true;
  }

  deleteRow(row1: number) {
    if (row1 >= 1 && row1 <= this.matrix.length) {
      this.matrix.splice(row1 - 1, 1);
      this.dirty = true;
    }
  }
}

// ============================================================
// STORE (load/flush per request)
// ============================================================

const SHEET_TABLES: Record<string, { headers: string[]; rows: any[][] }> = {};

const cache: Map<string, VirtualSheet> = new Map();

// Nama-nama sheet yang dikenal beserta header default (dipakai bila tabel kosong).
// Urutan header di sini harus sama dengan seed supabase/migrations/001_schema.sql.
const KNOWN_SHEETS: Record<string, string[]> = {
  USERS: ['Username', 'Password', 'Cabang', 'Role', 'Nama'],
  SURAT_JALAN: [
    'ID', 'No Surat Jalan', 'Tanggal', 'Cabang Asal', 'Cabang Tujuan',
    'Kode Jenis Barang', 'Dikirim Via', 'Total Barang', 'Status Kirim Cikupa',
    'Dibuat Oleh', 'Waktu Input', 'Perlu Diteruskan', 'Tujuan Akhir',
    'Tanggal Kirim Lanjutan', 'No Truk', 'Sopir', 'Status Kirim Pusat',
    'Diupdate Oleh', 'Waktu Update',
  ],
  DETAIL_SURAT_JALAN: [
    'ID Detail', 'ID Surat Jalan', 'No', 'No Bukti', 'Deskripsi', 'Qty',
    'Satuan', 'Keterangan', 'Status Fisik', 'Diterima Oleh', 'Waktu Diterima',
  ],
  REF_JENIS_BARANG: ['Kode', 'Nama Jenis'],
  REF_CABANG: ['Kode', 'Nama Cabang'],
  ALAMAT: [
    'SITE', 'WILAYAH', 'PENGIRIM', 'PIC', 'DEPT', 'ALAMAT',
    'KELURAHAN', 'KECAMATAN', 'KOTA', 'TLP',
  ],
  PENERIMAAN_SURAT_JALAN: [
    'ID', 'No Surat Jalan', 'Tanggal', 'Rms', 'No Truk', 'Kurir',
    'No Bukti', 'Deskripsi', 'Qty', 'Satuan', 'Keterangan',
    'Status Fisik', 'Diterima Oleh', 'Waktu Input',
  ],
  DETAIL_PENERIMAAN_SURAT_JALAN: [
    'ID Detail', 'ID Surat Jalan', 'No', 'No Bukti', 'Deskripsi', 'Qty',
    'Satuan', 'Keterangan', 'Status Fisik', 'Diterima Oleh', 'Waktu Diterima',
    'Tujuan Site', 'Status Kirim', 'ID SJ Kirim', 'No SJ Kirim',
  ],
};

export async function loadStore(): Promise<void> {
  SHEET_TABLES.length = 0 as any;
  cache.clear();
  const { data, error } = await getSupabase()
    .from('sheet_rows')
    .select('name, ord, row')
    .order('ord', { ascending: true });
  if (error) throw new Error('Gagal membaca store: ' + error.message);

  const grouped: Record<string, any[][]> = {};
  for (const d of data || []) {
    const arr = Array.isArray(d.row) ? d.row : JSON.parse(d.row || '[]');
    if (!grouped[d.name]) grouped[d.name] = [];
    grouped[d.name].push(arr);
  }

  for (const name of Object.keys(grouped)) {
    let rows = grouped[name].filter((r: any[]) => r && r.length > 0);
    if (rows.length === 0) rows = [KNOWN_SHEETS[name] || []];
    cache.set(name, new VirtualSheet(name, rows));
  }
}

export function getSheet_(name: string): VirtualSheet {
  let sheet = cache.get(name);
  if (!sheet) {
    // Buat sheet kosong dengan header default supaya operasi tetap aman.
    const headers = KNOWN_SHEETS[name] || [];
    sheet = new VirtualSheet(name, [headers]);
    sheet.dirty = true;
    cache.set(name, sheet);
  }
  return sheet;
}

export function sheetToObjects_(sheet: VirtualSheet): any[] {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data
    .slice(1)
    .filter((r: any[]) => String(r.join('')).replace(/\u0000/g, '') !== '')
    .map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h: string, i: number) => (obj[h] = row[i]));
      return obj;
    });
}

export function cariRowIndexById_(sheet: VirtualSheet, idColName: string, idValue: any): number {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf(idColName);
  if (idCol === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === idValue || String(data[i][idCol]) === String(idValue)) return i + 1;
  }
  return -1;
}

// Flush semua sheet yang berubah (dirty) kembali ke Postgres.
export async function flushStore(): Promise<void> {
  const dirtySheets = [...cache.values()].filter((s) => s.dirty);
  if (dirtySheets.length === 0) return;

  for (const sheet of dirtySheets) {
    const db = getSupabase();
    // Hapus baris lama lalu tulis ulang (termasuk header sebagai ord 0).
    await db.from('sheet_rows').delete().eq('name', sheet.name);
    const rowsToInsert: any[] = sheet.matrix.map((r: any[], idx: number) => ({
      name: sheet.name,
      ord: idx,
      row: JSON.parse(JSON.stringify(r)),
    }));
    // chunk insert 500 per batch
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const chunk = rowsToInsert.slice(i, i + 500);
      const { error } = await db.from('sheet_rows').insert(chunk);
      if (error) throw new Error('Gagal menyimpan ' + sheet.name + ': ' + error.message);
    }
    sheet.dirty = false;
  }
}

// ============================================================
// SHIM Utilities / Logger / Session (mirip Apps Script)
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