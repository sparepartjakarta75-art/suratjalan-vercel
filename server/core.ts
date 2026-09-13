/**
 * ============================================================
 * CORE.TS — Logika bisnis (port dari SuratJalan.ts + References.ts)
 * ============================================================
 * Revisi performa (migration 002): tabel transaksi utama
 * (SURAT_JALAN, DETAIL_SURAT_JALAN, PENERIMAAN_SURAT_JALAN,
 * DETAIL_PENERIMAAN_SURAT_JALAN) kini berupa tabel Postgres
 * relasional yang diakses langsung via Supabase query + index.
 * Data referensi kecil (USERS, ALAMAT, REF_*) tetap memakai
 * virtual-sheet shim karena jarang berubah.
 * ============================================================
 */

import {
  getSupabase,
  getSheet_,
  sheetToObjects_,
  Utilities,
  Session,
  Logger,
} from './sheets';
import {
  SHEET_JENIS_BARANG,
  SHEET_CABANG,
  SHEET_ALAMAT,
} from './constants';

const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function safeFormatDate(val: any, fmt: string): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), fmt);
  } catch (e) {
    return '';
  }
}

/* ============================================================
   MAPPING KOLOM: baris DB (snake_case) <-> objek ala-sheet
   ============================================================ */

const SJ_APP_COLS: Array<[string, string]> = [
  ['id', 'ID'],
  ['no_surat_jalan', 'No Surat Jalan'],
  ['tanggal', 'Tanggal'],
  ['cabang_asal', 'Cabang Asal'],
  ['cabang_tujuan', 'Cabang Tujuan'],
  ['kode_jenis_barang', 'Kode Jenis Barang'],
  ['dikirim_via', 'Dikirim Via'],
  ['total_barang', 'Total Barang'],
  ['status_kirim_cikupa', 'Status Kirim Cikupa'],
  ['dibuat_oleh', 'Dibuat Oleh'],
  ['waktu_input', 'Waktu Input'],
  ['perlu_diteruskan', 'Perlu Diteruskan'],
  ['tujuan_akhir', 'Tujuan Akhir'],
  ['tanggal_kirim_lanjutan', 'Tanggal Kirim Lanjutan'],
  ['no_truk', 'No Truk'],
  ['sopir', 'Sopir'],
  ['status_kirim_pusat', 'Status Kirim Pusat'],
  ['diupdate_oleh', 'Diupdate Oleh'],
  ['waktu_update', 'Waktu Update'],
];

/** Baris surat_jalan (DB) -> objek dengan key ala-sheet. */
function sjDbToApp(r: any): any {
  const o: any = {};
  for (const [db, app] of SJ_APP_COLS) o[app] = r?.[db] ?? '';
  return o;
}

/** Baris detail_surat_jalan (DB) -> objek konsumen/client. */
function dsjDbToObj(r: any): any {
  return {
    idDetail: r?.id_detail ?? '',
    no: r?.no ?? 0,
    noBukti: r?.no_bukti ?? '',
    deskripsi: r?.deskripsi ?? '',
    qty: r?.qty ?? 0,
    satuan: r?.satuan ?? '',
    keterangan: r?.keterangan ?? '',
    statusFisik: r?.status_fisik ?? 'Belum Diterima',
    diterimaOleh: r?.diterima_oleh ?? '',
    waktuDiterima: r?.waktu_diterima ? safeFormatDate(r.waktu_diterima, 'dd/MM/yyyy HH:mm') : '',
  };
}

/** Baris detail_penerimaan_surat_jalan (DB) -> objek konsumen/client. */
function dpDbToObj(r: any): any {
  return {
    idDetail: r?.id_detail ?? '',
    no: r?.no ?? 0,
    noBukti: r?.no_bukti ?? '',
    deskripsi: r?.deskripsi ?? '',
    qty: r?.qty ?? 0,
    satuan: r?.satuan ?? '',
    keterangan: r?.keterangan ?? '',
    statusFisik: r?.status_fisik ?? 'Belum Diterima',
    diterimaOleh: r?.diterima_oleh ?? '',
    waktuDiterima: r?.waktu_diterima ? safeFormatDate(r.waktu_diterima, 'dd/MM/yyyy HH:mm') : '',
    tujuanSite: r?.tujuan_site ?? '',
    statusKirim: r?.status_kirim ?? 'Open',
    idSJKirim: r?.id_sj_kirim ?? '',
    noSJKirim: r?.no_sj_kirim ?? '',
  };
}

/* ===================== NOMOR SURAT JALAN ===================== */
export async function buatNomorSuratJalan_(cabangAsal, cabangTujuan, kodeJenis) {
  const now = new Date();
  const bulan = now.getMonth();
  const tahun = now.getFullYear();
  const start = new Date(tahun, bulan, 1);
  const next = new Date(tahun, bulan + 1, 1);

  const { data, error } = await getSupabase()
    .from('surat_jalan')
    .select('id')
    .eq('cabang_asal', cabangAsal)
    .gte('tanggal', start.toISOString())
    .lt('tanggal', next.toISOString());
  if (error) throw new Error('Gagal menghitung nomor surat jalan: ' + error.message);

  const jumlah = Array.isArray(data) ? data.length : 0;
  const bulanRomawi = BULAN_ROMAWI[bulan];
  const tahunSingkat = String(tahun).slice(-2);
  const urut = String(jumlah + 1).padStart(3, '0');
  return urut + '/' + kodeJenis + '-' + cabangTujuan + '/' + cabangAsal + '/' + bulanRomawi + '/' + tahunSingkat;
}

/* ===================== HELPER INTERNAL ===================== */
export async function ambilHeaderById_(id) {
  if (!id) return null;
  const { data, error } = await getSupabase()
    .from('surat_jalan')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return sjDbToApp(data);
}

export function cekIzinUbah_(header, role, cabang) {
  if (!header) return { ok: false, message: 'Data surat jalan tidak ditemukan.' };
  if (role !== 'admin' && header['Cabang Asal'] !== cabang) {
    return { ok: false, message: 'Anda hanya bisa mengubah surat jalan milik cabang Anda sendiri.' };
  }
  const status = header['Status Kirim Cikupa'];
  if (status === 'Diterima Cikupa' || status === 'Diterima Tujuan') {
    return { ok: false, message: 'Surat jalan yang sudah diterima tidak bisa diubah/dihapus.' };
  }
  return { ok: true };
}

async function insertDetailRows_(idSuratJalan, items) {
  const rows = items.map((d, idx) => ({
    id_detail: Utilities.getUuid(),
    id_surat_jalan: idSuratJalan,
    no: idx + 1,
    no_bukti: String(d.noBukti ?? ''),
    deskripsi: String(d.deskripsi ?? ''),
    qty: Number(d.qty) || 0,
    satuan: String(d.satuan ?? ''),
    keterangan: String(d.keterangan ?? ''),
    status_fisik: 'Belum Diterima',
    diterima_oleh: '',
    waktu_diterima: null,
  }));
  const { error } = await getSupabase().from('detail_surat_jalan').insert(rows);
  if (error) throw new Error('Gagal simpan detail surat jalan: ' + error.message);
}

export async function hapusDetailByHeaderId_(idSuratJalan) {
  const { error } = await getSupabase()
    .from('detail_surat_jalan')
    .delete()
    .eq('id_surat_jalan', idSuratJalan);
  if (error) throw new Error('Gagal menghapus detail: ' + error.message);
}

/* ===================== CREATE ===================== */
export async function tandaiEksternalPending_(idDetail, idSJKirim, noSJKirim) {
  await getSupabase()
    .from('detail_penerimaan_surat_jalan')
    .update({ status_kirim: 'Pending', id_sj_kirim: String(idSJKirim), no_sj_kirim: String(noSJKirim) })
    .eq('id_detail', idDetail);
}

export async function kembalikanEksternalOpen_(idSJKirim) {
  const { error } = await getSupabase()
    .from('detail_penerimaan_surat_jalan')
    .update({ status_kirim: 'Open', id_sj_kirim: '', no_sj_kirim: '' })
    .eq('id_sj_kirim', idSJKirim);
  if (error) throw new Error('Gagal mengembalikan status eksternal: ' + error.message);
}

export async function tutupEksternalBySJ_(idSJKirim) {
  const { error } = await getSupabase()
    .from('detail_penerimaan_surat_jalan')
    .update({ status_kirim: 'Close' })
    .eq('id_sj_kirim', idSJKirim);
  if (error) throw new Error('Gagal menutup status eksternal: ' + error.message);
}

export async function pendingkanEksternalBySJ_(idSJKirim) {
  const { error } = await getSupabase()
    .from('detail_penerimaan_surat_jalan')
    .update({ status_kirim: 'Pending' })
    .eq('id_sj_kirim', idSJKirim);
  if (error) throw new Error('Gagal mem-pending status eksternal: ' + error.message);
}

export async function simpanSuratJalan(payload) {
  if (!payload.cabangAsal || !payload.cabangTujuan || !payload.kodeJenis) {
    return { success: false, message: 'Cabang asal, cabang tujuan, dan kode jenis barang wajib diisi.' };
  }
  if (!payload.details || payload.details.length === 0) {
    return { success: false, message: 'Minimal 1 baris detail barang harus diisi.' };
  }
  for (let i = 0; i < payload.details.length; i++) {
    const d = payload.details[i];
    if (!d.deskripsi || !d.qty) {
      return { success: false, message: 'Baris ke-' + (i + 1) + ': Deskripsi dan Qty wajib diisi.' };
    }
  }

  const perluDiteruskan = payload.perluDiteruskan === 'Ya' ? 'Ya' : 'Tidak';
  const tujuanAkhir = perluDiteruskan === 'Ya' ? (payload.tujuanAkhir || '') : '';
  if (perluDiteruskan === 'Ya' && !tujuanAkhir) {
    return { success: false, message: 'Tujuan Akhir wajib diisi jika surat jalan perlu diteruskan.' };
  }

  const noSuratJalan = await buatNomorSuratJalan_(payload.cabangAsal, payload.cabangTujuan, payload.kodeJenis);
  const idHeader = Utilities.getUuid();
  const now = new Date();
  const statusAwal = perluDiteruskan === 'Ya' ? 'Dikirim' : 'Menunggu Penerimaan';

  const headerRow = {
    id: idHeader,
    no_surat_jalan: noSuratJalan,
    tanggal: now,
    cabang_asal: payload.cabangAsal,
    cabang_tujuan: payload.cabangTujuan,
    kode_jenis_barang: payload.kodeJenis,
    dikirim_via: payload.dikirimVia || '',
    total_barang: payload.details.length,
    status_kirim_cikupa: statusAwal,
    dibuat_oleh: payload.username || '',
    waktu_input: now,
    perlu_diteruskan: perluDiteruskan,
    tujuan_akhir: tujuanAkhir,
    tanggal_kirim_lanjutan: null,
    no_truk: '',
    sopir: '',
    status_kirim_pusat: perluDiteruskan === 'Ya' ? 'Menunggu Truk' : '',
    diupdate_oleh: '',
    waktu_update: null,
  };

  const { error: errHeader } = await getSupabase().from('surat_jalan').insert(headerRow);
  if (errHeader) throw new Error('Gagal simpan surat jalan: ' + errHeader.message);

  await insertDetailRows_(idHeader, payload.details);

  if (payload.externalItems && payload.externalItems.length) {
    for (const ext of payload.externalItems) {
      if (ext.idDetail) await tandaiEksternalPending_(ext.idDetail, idHeader, noSuratJalan);
    }
  }

  return { success: true, noSuratJalan };
}

/* ===================== READ: DAFTAR HEADER ===================== */
async function fetchDetailMap_(ids: string[]): Promise<Record<string, any[]>> {
  const detailMap: Record<string, any[]> = {};
  if (!ids.length) return detailMap;
  const { data, error } = await getSupabase()
    .from('detail_surat_jalan')
    .select('*')
    .in('id_surat_jalan', ids);
  if (error) throw new Error('Gagal memuat detail: ' + error.message);
  for (const d of data || []) {
    const hid = String(d.id_surat_jalan || '').trim();
    if (!hid) continue;
    if (!detailMap[hid]) detailMap[hid] = [];
    detailMap[hid].push({
      idDetail: d.id_detail || '',
      no: d.no || 0,
      noBukti: d.no_bukti || '',
      deskripsi: d.deskripsi || '',
      qty: d.qty || 0,
      satuan: d.satuan || '',
      keterangan: d.keterangan || '',
      statusFisik: d.status_fisik || 'Belum Diterima',
      diterimaOleh: d.diterima_oleh || '',
      waktuDiterima: d.waktu_diterima ? safeFormatDate(d.waktu_diterima, 'dd/MM/yyyy HH:mm') : '',
    });
  }
  return detailMap;
}

function tanggalMs(val: any): number {
  const d = new Date(String(val || ''));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export async function getDaftarSuratJalan(role, cabang) {
  try {
    const { data, error } = await getSupabase()
      .from('surat_jalan')
      .select('*')
      .order('waktu_input', { ascending: false });
    if (error) throw error;

    let hasil = (data || []).map(sjDbToApp).filter((row) => row['ID'] && String(row['ID']).trim() !== '');

    if (role !== 'admin') {
      hasil = hasil.filter((row) => {
        const cabangAsal = row['Cabang Asal'] || '';
        const cabangTujuan = row['Cabang Tujuan'] || '';
        const tujuanAkhir = row['Tujuan Akhir'] || '';
        const perluDiteruskan = row['Perlu Diteruskan'] || 'Tidak';
        const statusCikupa = row['Status Kirim Cikupa'] || '';

        if (cabangAsal.toUpperCase() === cabang.toUpperCase()) return true;
        if (perluDiteruskan === 'Tidak' && cabangTujuan.toUpperCase() === cabang.toUpperCase()) return true;
        if (perluDiteruskan === 'Ya' && tujuanAkhir.toUpperCase() === cabang.toUpperCase() && statusCikupa === 'Diterima Cikupa') return true;

        return false;
      });
    }

    hasil.sort((a, b) => tanggalMs(b['Waktu Input']) - tanggalMs(a['Waktu Input']));

    const ids = hasil.map((r) => r['ID']);
    const detailMap = await fetchDetailMap_(ids);

    return hasil.map((r) => ({
      id: r['ID'] || '',
      noSuratJalan: r['No Surat Jalan'] || '',
      tanggal: safeFormatDate(r['Tanggal'], 'dd/MM/yyyy'),
      cabangAsal: r['Cabang Asal'] || '',
      cabangTujuan: r['Cabang Tujuan'] || '',
      kodeJenis: r['Kode Jenis Barang'] || '',
      dikirimVia: r['Dikirim Via'] || '',
      totalBarang: (detailMap[r['ID']] || []).length || (r['Total Barang'] || 0),
      status: r['Status Kirim Cikupa'] || '',
      dibuatOleh: r['Dibuat Oleh'] || '',
      diupdateOleh: r['Diupdate Oleh'] || '',
      waktuUpdate: safeFormatDate(r['Waktu Update'], 'dd/MM/yyyy HH:mm'),
      perluDiteruskan: r['Perlu Diteruskan'] || '',
      tujuanAkhir: r['Tujuan Akhir'] || '',
      tanggalKirimLanjutan: safeFormatDate(r['Tanggal Kirim Lanjutan'], 'dd/MM/yyyy'),
      noTruk: r['No Truk'] || '',
      sopir: r['Sopir'] || '',
      statusKirimPusat: r['Status Kirim Pusat'] || '',
      items: (detailMap[r['ID']] || []).map(({ idDetail, no, statusFisik, diterimaOleh, waktuDiterima, ...rest }) => rest),
    }));
  } catch (err: any) {
    Logger.log('ERROR getDaftarSuratJalan: ' + err.message);
    throw new Error('Gagal memuat daftar surat jalan: ' + err.message);
  }
}

/* ===================== READ: DAFTAR SJ UNTUK TUJUAN (Penerimaan) ===================== */
export async function getDaftarSuratJalanUntukTujuan(cabangTujuan) {
  const { data, error } = await getSupabase()
    .from('surat_jalan')
    .select('*')
    .order('waktu_input', { ascending: false });
  if (error) throw new Error('Gagal memuat daftar surat jalan: ' + error.message);

  let hasil = (data || []).map(sjDbToApp).filter((row) => {
    const statusCikupa = row['Status Kirim Cikupa'] || '';
    const perluDiteruskan = row['Perlu Diteruskan'] || 'Tidak';
    const tujuanAkhir = row['Tujuan Akhir'] || '';
    const cabangTujuanRow = row['Cabang Tujuan'] || '';

    if (perluDiteruskan === 'Ya') {
      if (statusCikupa !== 'Diterima Cikupa') return false;
      return tujuanAkhir.toUpperCase() === cabangTujuan.toUpperCase();
    } else {
      if (statusCikupa === 'Diterima Tujuan') return false;
      return cabangTujuanRow.toUpperCase() === cabangTujuan.toUpperCase();
    }
  });

  hasil.sort((a, b) => {
    const aSelesai = (a['Status Kirim Cikupa'] || '') === 'Diterima Tujuan' || (a['Status Kirim Cikupa'] || '') === 'Diterima Cikupa';
    const bSelesai = (b['Status Kirim Cikupa'] || '') === 'Diterima Tujuan' || (b['Status Kirim Cikupa'] || '') === 'Diterima Cikupa';
    if (aSelesai && !bSelesai) return 1;
    if (!aSelesai && bSelesai) return -1;
    return tanggalMs(b['Waktu Input']) - tanggalMs(a['Waktu Input']);
  });

  const ids = hasil.map((r) => r['ID']);
  const detailMap = await fetchDetailMap_(ids);

  return hasil.map((r) => ({
    id: r['ID'],
    noSuratJalan: r['No Surat Jalan'],
    tanggal: safeFormatDate(r['Tanggal'], 'dd/MM/yyyy'),
    cabangAsal: r['Cabang Asal'],
    cabangTujuan: r['Cabang Tujuan'],
    kodeJenis: r['Kode Jenis Barang'],
    dikirimVia: r['Dikirim Via'],
    totalBarang: (detailMap[r['ID']] || []).length || (r['Total Barang'] || 0),
    status: r['Status Kirim Cikupa'],
    dibuatOleh: r['Dibuat Oleh'],
    perluDiteruskan: r['Perlu Diteruskan'],
    tujuanAkhir: r['Tujuan Akhir'],
    tanggalKirimLanjutan: safeFormatDate(r['Tanggal Kirim Lanjutan'], 'dd/MM/yyyy'),
    noTruk: r['No Truk'],
    sopir: r['Sopir'],
    statusKirimPusat: r['Status Kirim Pusat']
  }));
}

/* ===================== READ: DETAIL BARANG ===================== */
export async function getDetailSuratJalan(idSuratJalan) {
  const { data, error } = await getSupabase()
    .from('detail_surat_jalan')
    .select('*')
    .eq('id_surat_jalan', idSuratJalan)
    .order('no', { ascending: true });
  if (error) throw new Error('Gagal memuat detail surat jalan: ' + error.message);
  return (data || []).map(dsjDbToObj);
}

/* ===================== READ: DATA UNTUK FORM EDIT ===================== */
export async function getSuratJalanForEdit(id, role, cabang) {
  const header = await ambilHeaderById_(id);
  const izin = cekIzinUbah_(header, role, cabang);
  if (!izin.ok) return { success: false, message: izin.message };

  return {
    success: true,
    header: {
      id: header['ID'],
      noSuratJalan: header['No Surat Jalan'],
      cabangAsal: header['Cabang Asal'],
      cabangTujuan: header['Cabang Tujuan'],
      kodeJenis: header['Kode Jenis Barang'],
      dikirimVia: header['Dikirim Via'],
      status: header['Status Kirim Cikupa'],
      perluDiteruskan: header['Perlu Diteruskan'],
      tujuanAkhir: header['Tujuan Akhir']
    },
    details: await getDetailSuratJalan(id)
  };
}

/* ===================== UPDATE (EDIT oleh Cabang/Admin) ===================== */
export async function updateSuratJalan(id, payload) {
  const header = await ambilHeaderById_(id);
  const izin = cekIzinUbah_(header, payload.role, payload.cabang);
  if (!izin.ok) return { success: false, message: izin.message };

  if (!payload.details || payload.details.length === 0) {
    return { success: false, message: 'Minimal 1 baris detail barang harus diisi.' };
  }
  for (let i = 0; i < payload.details.length; i++) {
    const d = payload.details[i];
    if (!d.deskripsi || !d.qty) {
      return { success: false, message: 'Baris ke-' + (i + 1) + ': Deskripsi dan Qty wajib diisi.' };
    }
  }

  if (!payload.cabangAsal || !payload.cabangTujuan || !payload.kodeJenis) {
    return { success: false, message: 'Asal, Tujuan, dan Kode Jenis Barang wajib diisi.' };
  }

  const perluDiteruskan = payload.perluDiteruskan === 'Ya' ? 'Ya' : 'Tidak';
  const tujuanAkhir = perluDiteruskan === 'Ya' ? (payload.tujuanAkhir || '') : '';
  if (perluDiteruskan === 'Ya' && !tujuanAkhir) {
    return { success: false, message: 'Tujuan Akhir wajib diisi jika surat jalan perlu diteruskan.' };
  }

  const updateObj: any = {
    cabang_asal: payload.cabangAsal,
    cabang_tujuan: payload.cabangTujuan,
    kode_jenis_barang: payload.kodeJenis,
    dikirim_via: payload.dikirimVia || '',
    total_barang: payload.details.length,
    perlu_diteruskan: perluDiteruskan,
    tujuan_akhir: tujuanAkhir,
    diupdate_oleh: payload.username || '',
    waktu_update: new Date(),
  };

  const statusPusatSaatIni = header['Status Kirim Pusat'] || '';
  if (perluDiteruskan === 'Ya' && !statusPusatSaatIni) {
    updateObj.status_kirim_pusat = 'Menunggu Truk';
  } else if (perluDiteruskan === 'Tidak') {
    updateObj.status_kirim_pusat = '';
  }

  const { error: errUpdate } = await getSupabase()
    .from('surat_jalan')
    .update(updateObj)
    .eq('id', id);
  if (errUpdate) throw new Error('Gagal mengupdate surat jalan: ' + errUpdate.message);

  await hapusDetailByHeaderId_(id);
  await insertDetailRows_(id, payload.details);

  return { success: true };
}

/* ===================== TANDAI STATUS FISIK PER ITEM ===================== */
export async function updateStatusFisikDetail(idDetail, statusBaru, role, username) {
  if (role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa menandai status fisik barang.' };
  }

  const { data: dRow, error: errGet } = await getSupabase()
    .from('detail_surat_jalan')
    .select('id_surat_jalan')
    .eq('id_detail', idDetail)
    .maybeSingle();
  if (errGet) return { success: false, message: 'Detail tidak ditemukan.' };
  if (!dRow) return { success: false, message: 'Baris detail tidak ditemukan.' };

  const { error: errUpd } = await getSupabase()
    .from('detail_surat_jalan')
    .update({
      status_fisik: statusBaru,
      diterima_oleh: statusBaru === 'Diterima' ? username : '',
      waktu_diterima: statusBaru === 'Diterima' ? new Date() : null,
    })
    .eq('id_detail', idDetail);
  if (errUpd) return { success: false, message: 'Gagal menandai status: ' + errUpd.message };

  const statusHeaderBaru = await hitungUlangStatusHeader_(dRow.id_surat_jalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

export async function hitungUlangStatusHeader_(idSuratJalan, username) {
  const details = await getDetailSuratJalan(idSuratJalan);
  const totalDiterima = details.filter((d) => d.statusFisik === 'Diterima').length;

  const header = await ambilHeaderById_(idSuratJalan);
  const perluDiteruskan = header ? (header['Perlu Diteruskan'] || 'Tidak') : 'Tidak';

  let statusBaru;
  if (perluDiteruskan === 'Ya') {
    if (totalDiterima === 0) statusBaru = 'Dikirim';
    else if (totalDiterima === details.length) statusBaru = 'Diterima Cikupa';
    else statusBaru = 'Diterima Sebagian';
  } else {
    if (totalDiterima === 0) statusBaru = 'Menunggu Penerimaan';
    else if (totalDiterima === details.length) statusBaru = 'Diterima Tujuan';
    else statusBaru = 'Diterima Sebagian';
  }

  const { error } = await getSupabase()
    .from('surat_jalan')
    .update({
      status_kirim_cikupa: statusBaru,
      diupdate_oleh: username || '',
      waktu_update: new Date(),
    })
    .eq('id', idSuratJalan);
  if (error) throw new Error('Gagal mengupdate status header: ' + error.message);

  if (statusBaru === 'Diterima Tujuan') {
    await tutupEksternalBySJ_(idSuratJalan);
  } else {
    await pendingkanEksternalBySJ_(idSuratJalan);
  }

  return statusBaru;
}

/* ===================== SIMPAN PENERIMAAN MASSAL ===================== */
export async function simpanPenerimaanBarang(idSuratJalan, items, role, username) {
  if (role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa menyimpan penerimaan barang.' };
  }
  if (!items || !items.length) {
    return { success: false, message: 'Tidak ada item yang dikirim.' };
  }

  const now = new Date();
  for (const item of items) {
    const { error } = await getSupabase()
      .from('detail_surat_jalan')
      .update({
        status_fisik: item.diterima ? 'Diterima' : 'Belum Diterima',
        diterima_oleh: item.diterima ? username : '',
        waktu_diterima: item.diterima ? now : null,
      })
      .eq('id_detail', item.idDetail);
    if (error) throw new Error('Gagal update penerimaan: ' + error.message);
  }

  const statusHeaderBaru = await hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

/* ===================== BATAL PENERIMAAN ===================== */
export async function batalkanPenerimaan(idSuratJalan, role, username) {
  if (role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa membatalkan status penerimaan.' };
  }

  const { data, error } = await getSupabase()
    .from('detail_surat_jalan')
    .select('id_detail')
    .eq('id_surat_jalan', idSuratJalan);
  if (error) throw new Error('Gagal memuat detail: ' + error.message);
  if (!data || data.length === 0) return { success: false, message: 'Tidak ada detail barang ditemukan untuk surat jalan ini.' };

  for (const d of data) {
    const { error: errU } = await getSupabase()
      .from('detail_surat_jalan')
      .update({ status_fisik: 'Belum Diterima', diterima_oleh: '', waktu_diterima: null })
      .eq('id_detail', d.id_detail);
    if (errU) throw new Error('Gagal reset detail: ' + errU.message);
  }

  const statusHeaderBaru = await hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

/* ===================== TERIMA BARANG OLEH TUJUAN AKHIR ===================== */
export async function terimaBarangTujuan(idSuratJalan, items, role, username, cabangUser) {
  if (role === 'admin') {
    return { success: false, message: 'Admin Pusat gunakan fitur "Penerimaan Barang" di daftar surat jalan.' };
  }

  const header = await ambilHeaderById_(idSuratJalan);
  if (!header) return { success: false, message: 'Data surat jalan tidak ditemukan.' };

  const tujuanAkhir = header['Tujuan Akhir'] || '';
  const cabangTujuan = header['Cabang Tujuan'] || '';
  const tujuanYangDiharapkan = header['Perlu Diteruskan'] === 'Ya' ? tujuanAkhir : cabangTujuan;

  if (!tujuanYangDiharapkan || tujuanYangDiharapkan.toUpperCase() !== cabangUser.toUpperCase()) {
    return { success: false, message: 'Surat jalan ini bukan untuk cabang Anda (' + cabangUser + '). Tujuan: ' + tujuanYangDiharapkan };
  }

  if (!items || !items.length) {
    return { success: false, message: 'Tidak ada item yang dikirim.' };
  }

  const now = new Date();
  for (const item of items) {
    const { error } = await getSupabase()
      .from('detail_surat_jalan')
      .update({
        status_fisik: item.diterima ? 'Diterima' : 'Belum Diterima',
        diterima_oleh: item.diterima ? username : '',
        waktu_diterima: item.diterima ? now : null,
      })
      .eq('id_detail', item.idDetail);
    if (error) throw new Error('Gagal update penerimaan tujuan: ' + error.message);
  }

  const statusHeaderBaru = await hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

/* ===================== TERIMA BARANG DARI EKSTERNAL ===================== */
export async function terimaBarangEksternal(idSuratJalan, items, username, externalSource) {
  if (!externalSource || !['RMS KUDUS', 'RMS SAYUNG'].includes(externalSource)) {
    return { success: false, message: 'Sumber eksternal tidak valid. Hanya RMS KUDUS dan RMS SAYUNG yang diizinkan.' };
  }

  const header = await ambilHeaderById_(idSuratJalan);
  if (!header) return { success: false, message: 'Data surat jalan tidak ditemukan.' };

  if (!items || !items.length) {
    return { success: false, message: 'Tidak ada item yang dikirim.' };
  }

  const now = new Date();
  for (const item of items) {
    const { error } = await getSupabase()
      .from('detail_surat_jalan')
      .update({
        status_fisik: item.diterima ? 'Diterima' : 'Belum Diterima',
        diterima_oleh: item.diterima ? username : '',
        waktu_diterima: item.diterima ? now : null,
      })
      .eq('id_detail', item.idDetail);
    if (error) throw new Error('Gagal update penerimaan eksternal: ' + error.message);
  }

  const statusHeaderBaru = await hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru, source: externalSource };
}

/* ===================== BUAT PENERIMAAN EKSTERNAL (dari RMS) ===================== */
export async function simpanPenerimaanEksternal(payload) {
  if (!payload.sumber || !['KUDUS', 'SAYUNG'].includes(payload.sumber)) {
    return { success: false, message: 'Sumber harus KUDUS atau SAYUNG.' };
  }
  if (!payload.noSurat || !payload.noSurat.trim()) {
    return { success: false, message: 'No Surat wajib diisi.' };
  }
  if (!payload.details || payload.details.length === 0) {
    return { success: false, message: 'Minimal 1 baris detail barang harus diisi.' };
  }
  for (let i = 0; i < payload.details.length; i++) {
    const d = payload.details[i];
    if (!d.deskripsi || !d.qty) {
      return { success: false, message: 'Baris ke-' + (i + 1) + ': Deskripsi dan Qty wajib diisi.' };
    }
    if (!d.tujuanSite) {
      return { success: false, message: 'Baris ke-' + (i + 1) + ': Tujuan wajib diisi.' };
    }
  }

  const idGroup = Utilities.getUuid();
  const now = new Date();
  const tanggal = payload.tanggal ? new Date(payload.tanggal) : now;

  const headerRow = {
    id: idGroup,
    no_surat_jalan: payload.noSurat.trim(),
    tanggal,
    rms: payload.sumber,
    no_truk: payload.noTruk || '',
    kurir: payload.kurir || '',
    no_bukti: '',
    deskripsi: '',
    qty: '',
    satuan: '',
    keterangan: '',
    status_fisik: '',
    diterima_oleh: payload.username || '',
    waktu_input: now,
  };

  const { error: errH } = await getSupabase().from('penerimaan_surat_jalan').insert(headerRow);
  if (errH) throw new Error('Gagal simpan penerimaan eksternal: ' + errH.message);

  const dRows = payload.details.map((d, idx) => ({
    id_detail: Utilities.getUuid(),
    id_surat_jalan: idGroup,
    no: idx + 1,
    no_bukti: d.noBukti || '',
    deskripsi: d.deskripsi,
    qty: Number(d.qty) || 0,
    satuan: d.satuan || '',
    keterangan: d.keterangan || '',
    status_fisik: 'Diterima',
    diterima_oleh: payload.username || '',
    waktu_diterima: now,
    tujuan_site: d.tujuanSite || '',
    status_kirim: 'Open',
    id_sj_kirim: '',
    no_sj_kirim: '',
  }));

  const { error: errD } = await getSupabase().from('detail_penerimaan_surat_jalan').insert(dRows);
  if (errD) throw new Error('Gagal simpan detail eksternal: ' + errD.message);

  return { success: true, id: idGroup };
}

/* ===================== UPDATE TAHAP 2: PENGIRIMAN LANJUTAN ===================== */
export async function updatePengirimanLanjutan(id, payload) {
  if (payload.role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa mengisi data pengiriman lanjutan.' };
  }

  const header = await ambilHeaderById_(id);
  if (!header) return { success: false, message: 'Data surat jalan tidak ditemukan.' };
  if (header['Perlu Diteruskan'] !== 'Ya') {
    return { success: false, message: 'Surat jalan ini tidak ditandai untuk diteruskan ke tujuan akhir.' };
  }

  const updateObj: any = {
    tanggal_kirim_lanjutan: payload.tanggalKirimLanjutan ? new Date(payload.tanggalKirimLanjutan) : null,
    no_truk: payload.noTruk || '',
    sopir: payload.sopir || '',
    status_kirim_pusat: payload.statusKirimPusat || 'Menunggu Truk',
    diupdate_oleh: payload.username || '',
    waktu_update: new Date(),
  };
  if (!payload.tanggalKirimLanjutan) delete updateObj.tanggal_kirim_lanjutan;

  const { error } = await getSupabase().from('surat_jalan').update(updateObj).eq('id', id);
  if (error) throw new Error('Gagal update pengiriman lanjutan: ' + error.message);

  return { success: true };
}

/* ===================== DELETE ===================== */
export async function deleteSuratJalan(id, role, cabang) {
  const header = await ambilHeaderById_(id);
  const izin = cekIzinUbah_(header, role, cabang);
  if (!izin.ok) return { success: false, message: izin.message };

  await kembalikanEksternalOpen_(id);

  await hapusDetailByHeaderId_(id);

  const { error } = await getSupabase().from('surat_jalan').delete().eq('id', id);
  if (error) throw new Error('Gagal menghapus surat jalan: ' + error.message);

  return { success: true };
}

/* ===================== PENERIMAAN EKSTERNAL ===================== */
export async function getDaftarPenerimaanEksternal() {
  try {
    const [hRes, dRes] = await Promise.all([
      getSupabase().from('penerimaan_surat_jalan').select('*'),
      getSupabase().from('detail_penerimaan_surat_jalan').select('*'),
    ]);
    if (hRes.error) throw hRes.error;
    if (dRes.error) throw dRes.error;

    const headerData = (hRes.data || []).map((r) => ({
      ID: r.id,
      'No Surat Jalan': r.no_surat_jalan,
      Tanggal: r.tanggal,
      Rms: r.rms,
      'No Truk': r.no_truk,
      Kurir: r.kurir,
      'Diterima Oleh': r.diterima_oleh,
      'Waktu Input': r.waktu_input,
    }));
    // group detail per header (id_surat_jalan)
    const detailByHid: Record<string, any[]> = {};
    for (const raw of dRes.data || []) {
      const hid = String(raw.id_surat_jalan || '').trim();
      if (!hid) continue;
      if (!detailByHid[hid]) detailByHid[hid] = [];
      detailByHid[hid].push({
        idDetail: raw.id_detail || '',
        no: raw.no || 0,
        noBukti: raw.no_bukti || '',
        deskripsi: raw.deskripsi || '',
        qty: raw.qty || 0,
        satuan: raw.satuan || '',
        keterangan: raw.keterangan || '',
        statusFisik: raw.status_fisik || 'Belum Diterima',
        diterimaOleh: raw.diterima_oleh || '',
        waktuDiterima: raw.waktu_diterima ? safeFormatDate(raw.waktu_diterima, 'dd/MM/yyyy HH:mm') : '',
        tujuanSite: raw.tujuan_site || '',
        statusKirim: raw.status_kirim || 'Open',
        idSJKirim: raw.id_sj_kirim || '',
        noSJKirim: raw.no_sj_kirim || ''
      });
    }

    const result: any[] = [];
    headerData.forEach(function (r) {
      const id = String(r['ID'] || '').trim();
      if (!id) return;
      if (result.find((x) => x.id === id)) return;
      const items = detailByHid[id] || [];
      result.push({
        id: id,
        noSuratJalan: r['No Surat Jalan'] || '',
        tanggal: safeFormatDate(r['Tanggal'], 'dd/MM/yyyy'),
        rms: r['Rms'] || '',
        noTruk: r['No Truk'] || '',
        kurir: r['Kurir'] || '',
        diterimaOleh: r['Diterima Oleh'] || '',
        waktuInput: safeFormatDate(r['Waktu Input'], 'dd/MM/yyyy HH:mm'),
        items: items
      });
    });

    result.sort(function (a, b) {
      return tanggalMs(b.waktuInput) - tanggalMs(a.waktuInput);
    });
    return result;
  } catch (err: any) {
    Logger.log('ERROR getDaftarPenerimaanEksternal: ' + err.message);
    throw new Error('Gagal memuat daftar penerimaan eksternal: ' + err.message);
  }
}

export async function hapusPenerimaanEksternal(id) {
  const { data: exists, error: errExists } = await getSupabase()
    .from('penerimaan_surat_jalan')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (errExists) throw new Error('Gagal memuat penerimaan eksternal: ' + errExists.message);
  if (!exists) return { success: false, message: 'Data tidak ditemukan.' };

  const { error: errD } = await getSupabase()
    .from('detail_penerimaan_surat_jalan')
    .delete()
    .eq('id_surat_jalan', id);
  if (errD) throw new Error('Gagal menghapus detail eksternal: ' + errD.message);

  const { error: errH } = await getSupabase().from('penerimaan_surat_jalan').delete().eq('id', id);
  if (errH) throw new Error('Gagal menghapus penerimaan eksternal: ' + errH.message);

  return { success: true };
}

/* ===================== DETAIL VIEW PENERIMAAN EKSTERNAL ===================== */
export async function getPenerimaanEksternalDetail(id) {
  try {
    const { data: headerRow, error: errH } = await getSupabase()
      .from('penerimaan_surat_jalan')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (errH) throw errH;
    if (!headerRow) return { success: false, message: 'Data tidak ditemukan.' };

    const { data: dData, error: errD } = await getSupabase()
      .from('detail_penerimaan_surat_jalan')
      .select('*')
      .eq('id_surat_jalan', id)
      .order('no', { ascending: true });
    if (errD) throw errD;

    return {
      success: true,
      header: {
        id: id,
        noSuratJalan: headerRow.no_surat_jalan || '',
        tanggal: safeFormatDate(headerRow.tanggal, 'yyyy-MM-dd'),
        rms: headerRow.rms || '',
        noTruk: headerRow.no_truk || '',
        kurir: headerRow.kurir || '',
        diterimaOleh: headerRow.diterima_oleh || '',
        waktuInput: safeFormatDate(headerRow.waktu_input, 'dd/MM/yyyy HH:mm')
      },
      items: (dData || []).map(dpDbToObj)
    };
  } catch (err: any) {
    Logger.log('ERROR getPenerimaanEksternalDetail: ' + err.message);
    throw new Error('Gagal memuat detail: ' + err.message);
  }
}

/* ===================== UPDATE / EDIT PENERIMAAN EKSTERNAL ===================== */
export async function updatePenerimaanEksternal(id, payload) {
  if (!payload.noSurat || !payload.noSurat.trim()) {
    return { success: false, message: 'No Surat Jalan wajib diisi.' };
  }
  if (!payload.details || payload.details.length === 0) {
    return { success: false, message: 'Minimal 1 baris detail barang harus diisi.' };
  }

  const { data: exists, error: errH } = await getSupabase()
    .from('penerimaan_surat_jalan')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (errH) throw errH;
  if (!exists) return { success: false, message: 'Data tidak ditemukan.' };

  const updateHeader: any = {
    no_surat_jalan: payload.noSurat.trim(),
    no_truk: payload.noTruk || '',
    kurir: payload.kurir || '',
  };
  if (payload.tanggal) updateHeader.tanggal = new Date(payload.tanggal);
  if (payload.sumber) updateHeader.rms = payload.sumber;
  await getSupabase().from('penerimaan_surat_jalan').update(updateHeader).eq('id', id);

  // Tangkap status kirim lama per no bukti agar tetap dipertahankan.
  const { data: oldDetails, error: errOld } = await getSupabase()
    .from('detail_penerimaan_surat_jalan')
    .select('no_bukti, status_kirim, id_sj_kirim, no_sj_kirim')
    .eq('id_surat_jalan', id);
  if (errOld) throw errOld;

  const statusKirimLama: Record<string, { statusKirim: string; idSJKirim: string; noSJKirim: string }> = {};
  for (const d of oldDetails || []) {
    const buktiKey = String(d.no_bukti || '').trim();
    if (buktiKey && (d.status_kirim === 'Pending' || d.status_kirim === 'Close')) {
      statusKirimLama[buktiKey] = {
        statusKirim: d.status_kirim,
        idSJKirim: d.id_sj_kirim || '',
        noSJKirim: d.no_sj_kirim || '',
      };
    }
  }

  await getSupabase().from('detail_penerimaan_surat_jalan').delete().eq('id_surat_jalan', id);

  const now = new Date();
  const dRows = payload.details.map((d, idx) => {
    const kirimPertahankan = statusKirimLama[String(d.noBukti || '').trim()];
    return {
      id_detail: Utilities.getUuid(),
      id_surat_jalan: id,
      no: idx + 1,
      no_bukti: d.noBukti || '',
      deskripsi: d.deskripsi || '',
      qty: Number(d.qty) || 0,
      satuan: d.satuan || '',
      keterangan: d.keterangan || '',
      status_fisik: d.statusFisik || 'Diterima',
      diterima_oleh: d.diterimaOleh || payload.username || '',
      waktu_diterima: d.waktuDiterima ? new Date(d.waktuDiterima) : now,
      tujuan_site: d.tujuanSite || '',
      status_kirim: kirimPertahankan ? kirimPertahankan.statusKirim : (d.statusKirim || 'Open'),
      id_sj_kirim: kirimPertahankan ? kirimPertahankan.idSJKirim : (d.idSJKirim || ''),
      no_sj_kirim: kirimPertahankan ? kirimPertahankan.noSJKirim : (d.noSJKirim || ''),
    };
  });

  const { error: errIns } = await getSupabase().from('detail_penerimaan_surat_jalan').insert(dRows);
  if (errIns) throw new Error('Gagal simpan detail eksternal: ' + errIns.message);

  return { success: true };
}

/* ===================== KIRIMAN PENDING & OPEN PENERIMAAN EKSTERNAL ===================== */
export async function getDaftarKirimanPending(role, cabang) {
  try {
    const [dRes, hRes] = await Promise.all([
      getSupabase().from('detail_penerimaan_surat_jalan').select('*'),
      getSupabase().from('penerimaan_surat_jalan').select('*'),
    ]);
    if (dRes.error) throw dRes.error;
    if (hRes.error) throw hRes.error;

    const details = (dRes.data || []).map(dpDbToObj);
    const headerMap = new Map(
      (hRes.data || []).map((r) => [String(r.id || '').trim(),
        { sumber: r.rms || '', noSuratPenerimaan: r.no_surat_jalan || '', tanggal: r.tanggal }]),
    );
    const headerIdByDetail = new Map(
      (dRes.data || []).map((r) => [String(r.id_detail || '').trim(), String(r.id_surat_jalan || '').trim()]),
    );

    const result: any[] = [];
    details.forEach(function (d) {
      var statusKirim = d.statusKirim || 'Open';
      if (statusKirim === 'Close') return;

      var tujuan = d.tujuanSite || '';
      var cabangFilter = cabang ? String(cabang).toUpperCase() : '';
      if (role !== 'admin' && cabangFilter && tujuan.toUpperCase() !== cabangFilter) return;

      const headerId = headerIdByDetail.get(String(d.idDetail || '').trim()) || '';
      const headerInfo = headerMap.get(headerId);

      result.push({
        idDetail: d.idDetail || '',
        noBukti: d.noBukti || '',
        deskripsi: d.deskripsi || '',
        qty: d.qty || 0,
        satuan: d.satuan || '',
        keterangan: d.keterangan || '',
        tujuanSite: tujuan,
        statusKirim: statusKirim,
        noSJKirim: d.noSJKirim || '',
        idSJKirim: d.idSJKirim || '',
        sumber: headerInfo ? (headerInfo.sumber || '') : '',
        noSuratPenerimaan: headerInfo ? (headerInfo.noSuratPenerimaan || '') : '',
        tanggalPenerimaan: headerInfo ? safeFormatDate(headerInfo.tanggal, 'dd/MM/yyyy') : ''
      });
    });

    result.sort(function (a, b) {
      if ((a.statusKirim === 'Open') !== (b.statusKirim === 'Open')) return a.statusKirim === 'Open' ? -1 : 1;
      return String(a.noBukti).localeCompare(String(b.noBukti));
    });
    return result;
  } catch (err: any) {
    Logger.log('ERROR getDaftarKirimanPending: ' + err.message);
    throw new Error('Gagal memuat daftar kiriman pending: ' + err.message);
  }
}

export async function getOpenPenerimaanEksternalUntukTujuan(tujuanSite) {
  try {
    const [dRes, hRes] = await Promise.all([
      getSupabase().from('detail_penerimaan_surat_jalan').select('*').eq('status_kirim', 'Open'),
      getSupabase().from('penerimaan_surat_jalan').select('*'),
    ]);
    if (dRes.error) throw dRes.error;
    if (hRes.error) throw hRes.error;

    const tujuanFilter = String(tujuanSite || '').toUpperCase();
    const headerMap = new Map((hRes.data || []).map((r) => [String(r.id || '').trim(), r]));

    const result: any[] = [];
    for (const raw of dRes.data || []) {
      const tujuan = (raw.tujuan_site || '').toUpperCase();
      if (tujuanFilter && tujuan !== tujuanFilter) continue;

      const headerId = String(raw.id_surat_jalan || '').trim();
      const headerInfo = headerMap.get(headerId);

      result.push({
        idDetail: raw.id_detail || '',
        noBukti: raw.no_bukti || '',
        deskripsi: raw.deskripsi || '',
        qty: raw.qty || 0,
        satuan: raw.satuan || '',
        keterangan: raw.keterangan || '',
        tujuanSite: raw.tujuan_site || '',
        sumber: headerInfo ? (headerInfo.rms || '') : '',
        noSuratPenerimaan: headerInfo ? (headerInfo.no_surat_jalan || '') : ''
      });
    }
    return result;
  } catch (err: any) {
    Logger.log('ERROR getOpenPenerimaanEksternalUntukTujuan: ' + err.message);
    throw new Error('Gagal memuat barang eksternal untuk tujuan: ' + err.message);
  }
}

/* ===================== REFERENCES ===================== */
export function getJenisBarangList() {
  return sheetToObjects_(getSheet_(SHEET_JENIS_BARANG));
}

export function getCabangList() {
  return sheetToObjects_(getSheet_(SHEET_CABANG));
}

export function getAlamatList() {
  const sheet = getSheet_(SHEET_ALAMAT);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const siteCol = headers.indexOf('SITE');
  const wilayahCol = headers.indexOf('WILAYAH');
  if (siteCol === -1) return [];

  return data.slice(1)
    .filter((r) => r[siteCol])
    .map((r) => ({ site: r[siteCol], wilayah: wilayahCol !== -1 ? r[wilayahCol] : '' }));
}

export function getAlamatFullList() {
  const raw = sheetToObjects_(getSheet_(SHEET_ALAMAT));
  const keyMap: Record<string, string> = {
    SITE: 'site', WILAYAH: 'wilayah', PENGIRIM: 'pengirim',
    PIC: 'pic', DEPT: 'dept', ALAMAT: 'alamat',
    KELURAHAN: 'kelurahan', KECAMATAN: 'kecamatan', KOTA: 'kota', TLP: 'tlp',
  };
  return raw.map((row: any) => {
    const obj: Record<string, string> = {};
    for (const [sheetKey, clientKey] of Object.entries(keyMap)) {
      obj[clientKey] = row[sheetKey] || '';
    }
    return obj;
  });
}

export function simpanAlamat(payload: any) {
  if (!payload.site) return { success: false, message: 'SITE wajib diisi.' };
  const sheet = getSheet_(SHEET_ALAMAT);
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return { success: false, message: 'Sheet ALAMAT kosong.' };

  const headers = data[0];
  const siteCol = headers.indexOf('SITE');

  let existRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][siteCol]).trim().toLowerCase() === String(payload.site).trim().toLowerCase()) {
      existRow = i + 1;
      break;
    }
  }

  const colMap: Record<string, string> = {
    site: 'SITE', wilayah: 'WILAYAH', pengirim: 'PENGIRIM',
    pic: 'PIC', dept: 'DEPT', alamat: 'ALAMAT',
    kelurahan: 'KELURAHAN', kecamatan: 'KECAMATAN', kota: 'KOTA', tlp: 'TLP',
  };

  if (existRow > 0) {
    for (const [key, colName] of Object.entries(colMap)) {
      const colIdx = headers.indexOf(colName);
      if (colIdx !== -1 && payload[key] !== undefined) {
        sheet.getRange(existRow, colIdx + 1).setValue(payload[key]);
      }
    }
  } else {
    const newRow = headers.map((h: string) => {
      const entry = Object.entries(colMap).find(([, v]) => v === h);
      return entry ? (payload[entry[0]] || '') : '';
    });
    sheet.appendRow(newRow);
  }

  return { success: true };
}

export function hapusAlamat(site: string) {
  if (!site) return { success: false, message: 'SITE wajib diisi.' };
  const sheet = getSheet_(SHEET_ALAMAT);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: false, message: 'Tidak ada data.' };

  const headers = data[0];
  const siteCol = headers.indexOf('SITE');

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][siteCol]).trim().toLowerCase() === String(site).trim().toLowerCase()) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'Alamat tidak ditemukan.' };
}