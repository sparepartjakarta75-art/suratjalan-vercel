/**
 * ============================================================
 * CORE.TS — Logika bisnis (port dari SuratJalan.ts + References.ts)
 * ============================================================
 * Diport hampir verbatim dari versi Apps Script; operasi I/O
 * memakai virtual-sheet shim di server/sheets.ts.
 * ============================================================
 */

import {
  getSheet_,
  sheetToObjects_,
  cariRowIndexById_,
  Utilities,
  Session,
  Logger,
} from './sheets';
import {
  SHEET_USERS,
  SHEET_SURAT_JALAN,
  SHEET_DETAIL,
  SHEET_JENIS_BARANG,
  SHEET_CABANG,
  SHEET_ALAMAT,
  SHEET_PENERIMAAN_EXT,
  SHEET_DETAIL_PENERIMAAN_EXT,
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

/* ===================== NOMOR SURAT JALAN ===================== */
export function buatNomorSuratJalan_(cabangAsal, cabangTujuan, kodeJenis) {
  const data = sheetToObjects_(getSheet_(SHEET_SURAT_JALAN));

  const now = new Date();
  const bulan = now.getMonth();
  const tahun = now.getFullYear();
  const bulanRomawi = BULAN_ROMAWI[bulan];
  const tahunSingkat = String(tahun).slice(-2);

  const jumlah = data.filter(row => {
    const tgl = new Date(row['Tanggal']);
    return row['Cabang Asal'] === cabangAsal &&
      tgl.getMonth() === bulan &&
      tgl.getFullYear() === tahun;
  }).length;

  const urut = String(jumlah + 1).padStart(3, '0');
  return urut + '/' + kodeJenis + '-' + cabangTujuan + '/' + cabangAsal + '/' + bulanRomawi + '/' + tahunSingkat;
}

/* ===================== HELPER INTERNAL ===================== */
export function ambilHeaderById_(id) {
  const data = sheetToObjects_(getSheet_(SHEET_SURAT_JALAN));
  return data.find(r => r['ID'] === id) || null;
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

export function tulisDetailRow_(sheet, rowIdx, data) {
  const headers = sheet.getDataRange().getValues()[0];
  const colMap = {
    'ID Detail': Utilities.getUuid(),
    'ID Surat Jalan': data.idSuratJalan,
    'No': data.no,
    'No Bukti': data.noBukti || '',
    'Deskripsi': data.deskripsi,
    'Qty': data.qty,
    'Satuan': data.satuan || '',
    'Keterangan': data.keterangan || '',
    'Status Fisik': data.statusFisik || 'Belum Diterima',
    'Diterima Oleh': data.diterimaOleh || '',
    'Waktu Diterima': data.waktuDiterima || ''
  };
  for (const [headerName, value] of Object.entries(colMap)) {
    const colIdx = headers.indexOf(headerName);
    if (colIdx !== -1) {
      sheet.getRange(rowIdx, colIdx + 1).setValue(value);
    }
  }
}

export function hapusDetailByHeaderId_(idSuratJalan) {
  const sheet = getSheet_(SHEET_DETAIL);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idHeaderCol = headers.indexOf('ID Surat Jalan');

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idHeaderCol] === idSuratJalan) {
      sheet.deleteRow(i + 1);
    }
  }
}

/* ===================== CREATE ===================== */
export function cariRowDetailEksternalById_(idDetail) {
  var sheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ID Detail');
  if (idCol === -1) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(idDetail).trim()) return i + 1;
  }
  return -1;
}

export function tandaiEksternalPending_(idDetail, idSJKirim, noSJKirim) {
  var sheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var rowIdx = cariRowDetailEksternalById_(idDetail);
  if (rowIdx === -1) return;
  var headers = sheet.getDataRange().getValues()[0];
  function setCol(name, value) {
    var col = headers.indexOf(name);
    if (col !== -1) sheet.getRange(rowIdx, col + 1).setValue(value);
  }
  setCol('Status Kirim', 'Pending');
  setCol('ID SJ Kirim', idSJKirim);
  setCol('No SJ Kirim', noSJKirim);
}

export function kembalikanEksternalOpen_(idSJKirim) {
  var sheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  if (headers.length === 0) return;
  var idSJCol = headers.indexOf('ID SJ Kirim');
  var statusCol = headers.indexOf('Status Kirim');
  if (idSJCol === -1 || statusCol === -1) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idSJCol]).trim() === String(idSJKirim).trim()) {
      sheet.getRange(i + 1, statusCol + 1).setValue('Open');
      sheet.getRange(i + 1, idSJCol + 1).setValue('');
    }
  }
}

export function tutupEksternalBySJ_(idSJKirim) {
  var sheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  if (headers.length === 0) return;
  var idSJCol = headers.indexOf('ID SJ Kirim');
  var statusCol = headers.indexOf('Status Kirim');
  if (idSJCol === -1 || statusCol === -1) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idSJCol]).trim() === String(idSJKirim).trim()) {
      sheet.getRange(i + 1, statusCol + 1).setValue('Close');
    }
  }
}

export function pendingkanEksternalBySJ_(idSJKirim) {
  var sheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  if (headers.length === 0) return;
  var idSJCol = headers.indexOf('ID SJ Kirim');
  var statusCol = headers.indexOf('Status Kirim');
  if (idSJCol === -1 || statusCol === -1) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idSJCol]).trim() === String(idSJKirim).trim()) {
      sheet.getRange(i + 1, statusCol + 1).setValue('Pending');
    }
  }
}

export function simpanSuratJalan(payload) {
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

  const headerSheet = getSheet_(SHEET_SURAT_JALAN);
  const detailSheet = getSheet_(SHEET_DETAIL);

  const noSuratJalan = buatNomorSuratJalan_(payload.cabangAsal, payload.cabangTujuan, payload.kodeJenis);
  const idHeader = Utilities.getUuid();
  const now = new Date();

  const statusAwal = perluDiteruskan === 'Ya' ? 'Dikirim' : 'Menunggu Penerimaan';

  headerSheet.appendRow([
    idHeader, noSuratJalan, now, payload.cabangAsal, payload.cabangTujuan,
    payload.kodeJenis, payload.dikirimVia || '', payload.details.length,
    statusAwal, payload.username, now,
    perluDiteruskan, tujuanAkhir,
    '', '', '',
    perluDiteruskan === 'Ya' ? 'Menunggu Truk' : '',
    '', ''
  ]);

  payload.details.forEach(function (d, idx) {
    tulisDetailRow_(detailSheet, detailSheet.getLastRow() + 1, {
      idSuratJalan: idHeader,
      no: idx + 1,
      noBukti: d.noBukti,
      deskripsi: d.deskripsi,
      qty: d.qty,
      satuan: d.satuan,
      keterangan: d.keterangan
    });
  });

  if (payload.externalItems && payload.externalItems.length) {
    payload.externalItems.forEach(function (ext) {
      if (ext.idDetail) tandaiEksternalPending_(ext.idDetail, idHeader, noSuratJalan);
    });
  }

  return { success: true, noSuratJalan: noSuratJalan };
}

/* ===================== READ: DAFTAR HEADER ===================== */
export function getDaftarSuratJalan(role, cabang) {
  try {
    const data = sheetToObjects_(getSheet_(SHEET_SURAT_JALAN));
    const validData = data.filter(row => row['ID'] && String(row['ID']).trim() !== '');
    let hasil = validData;
    if (role !== 'admin') {
      hasil = validData.filter(row => {
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

    hasil.sort((a, b) => {
      var da = new Date(String(b['Waktu Input'] || ''));
      var db = new Date(String(a['Waktu Input'] || ''));
      return (isNaN(da.getTime()) ? 0 : da.getTime()) - (isNaN(db.getTime()) ? 0 : db.getTime());
    });

    const detailData = sheetToObjects_(getSheet_(SHEET_DETAIL));
    const jumlahPerHeader = {};
    detailData.forEach(function (d) {
      const key = d['ID Surat Jalan'];
      if (key) jumlahPerHeader[key] = (jumlahPerHeader[key] || 0) + 1;
    });

    const detailByHeader: Record<string, any[]> = {};
    detailData.forEach(function (d) {
      const hid = String(d['ID Surat Jalan'] || '').trim();
      if (!hid) return;
      if (!detailByHeader[hid]) detailByHeader[hid] = [];
      detailByHeader[hid].push({
        noBukti: d['No Bukti'] || '',
        deskripsi: d['Deskripsi'] || '',
        qty: d['Qty'] || 0,
        satuan: d['Satuan'] || '',
        keterangan: d['Keterangan'] || ''
      });
    });

    return hasil.map(r => ({
      id: r['ID'] || '',
      noSuratJalan: r['No Surat Jalan'] || '',
      tanggal: safeFormatDate(r['Tanggal'], 'dd/MM/yyyy'),
      cabangAsal: r['Cabang Asal'] || '',
      cabangTujuan: r['Cabang Tujuan'] || '',
      kodeJenis: r['Kode Jenis Barang'] || '',
      dikirimVia: r['Dikirim Via'] || '',
      totalBarang: jumlahPerHeader[r['ID']] || (r['Total Barang'] || 0),
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
      items: detailByHeader[r['ID']] || []
    }));
  } catch (err: any) {
    Logger.log('ERROR getDaftarSuratJalan: ' + err.message);
    throw new Error('Gagal memuat daftar surat jalan: ' + err.message);
  }
}

/* ===================== READ: DAFTAR SJ UNTUK TUJUAN (Penerimaan) ===================== */
export function getDaftarSuratJalanUntukTujuan(cabangTujuan) {
  const data = sheetToObjects_(getSheet_(SHEET_SURAT_JALAN));

  let hasil = data.filter(row => {
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
    const aStatus = a['Status Kirim Cikupa'] || '';
    const bStatus = b['Status Kirim Cikupa'] || '';
    const aSelesai = aStatus === 'Diterima Tujuan' || aStatus === 'Diterima Cikupa';
    const bSelesai = bStatus === 'Diterima Tujuan' || bStatus === 'Diterima Cikupa';
    if (aSelesai && !bSelesai) return 1;
    if (!aSelesai && bSelesai) return -1;
    var da = new Date(String(b['Waktu Input'] || ''));
    var db = new Date(String(a['Waktu Input'] || ''));
    return (isNaN(da.getTime()) ? 0 : da.getTime()) - (isNaN(db.getTime()) ? 0 : db.getTime());
  });

  const detailData = sheetToObjects_(getSheet_(SHEET_DETAIL));
  const jumlahPerHeader = {};
  detailData.forEach(function (d) {
    const key = d['ID Surat Jalan'];
    jumlahPerHeader[key] = (jumlahPerHeader[key] || 0) + 1;
  });

  return hasil.map(r => ({
    id: r['ID'],
    noSuratJalan: r['No Surat Jalan'],
    tanggal: safeFormatDate(r['Tanggal'], 'dd/MM/yyyy'),
    cabangAsal: r['Cabang Asal'],
    cabangTujuan: r['Cabang Tujuan'],
    kodeJenis: r['Kode Jenis Barang'],
    dikirimVia: r['Dikirim Via'],
    totalBarang: jumlahPerHeader[r['ID']] || (r['Total Barang'] || 0),
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
export function getDetailSuratJalan(idSuratJalan) {
  const data = sheetToObjects_(getSheet_(SHEET_DETAIL));
  return data
    .filter(r => r['ID Surat Jalan'] === idSuratJalan)
    .sort((a, b) => Number(a['No']) - Number(b['No']))
    .map(r => ({
      idDetail: r['ID Detail'],
      no: r['No'], noBukti: r['No Bukti'], deskripsi: r['Deskripsi'], qty: r['Qty'], satuan: r['Satuan'],
      keterangan: r['Keterangan'],
      statusFisik: r['Status Fisik'] || 'Belum Diterima',
      diterimaOleh: r['Diterima Oleh'],
      waktuDiterima: safeFormatDate(r['Waktu Diterima'], 'dd/MM/yyyy HH:mm')
    }));
}

/* ===================== READ: DATA UNTUK FORM EDIT ===================== */
export function getSuratJalanForEdit(id, role, cabang) {
  const header = ambilHeaderById_(id);
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
    details: getDetailSuratJalan(id)
  };
}

/* ===================== UPDATE (EDIT oleh Cabang/Admin) ===================== */
export function updateSuratJalan(id, payload) {
  const header = ambilHeaderById_(id);
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

  const headerSheet = getSheet_(SHEET_SURAT_JALAN);
  const rowIdx = cariRowIndexById_(headerSheet, 'ID', id);
  if (rowIdx === -1) return { success: false, message: 'Data surat jalan tidak ditemukan.' };

  const hHeaders = headerSheet.getDataRange().getValues()[0];
  function setHeaderIfExist(name, value) {
    const col = hHeaders.indexOf(name);
    if (col !== -1) headerSheet.getRange(rowIdx, col + 1).setValue(value);
  }
  setHeaderIfExist('Cabang Asal', payload.cabangAsal);
  setHeaderIfExist('Cabang Tujuan', payload.cabangTujuan);
  setHeaderIfExist('Kode Jenis Barang', payload.kodeJenis);
  setHeaderIfExist('Dikirim Via', payload.dikirimVia || '');
  setHeaderIfExist('Total Barang', payload.details.length);
  setHeaderIfExist('Perlu Diteruskan', perluDiteruskan);
  setHeaderIfExist('Tujuan Akhir', tujuanAkhir);
  setHeaderIfExist('Diupdate Oleh', payload.username || '');
  setHeaderIfExist('Waktu Update', new Date());
  const statusPusatCol = hHeaders.indexOf('Status Kirim Pusat');
  if (statusPusatCol !== -1) {
    const statusPusatSaatIni = headerSheet.getDataRange().getValues()[rowIdx - 1]?.[statusPusatCol];
    if (perluDiteruskan === 'Ya' && !statusPusatSaatIni) {
      headerSheet.getRange(rowIdx, statusPusatCol + 1).setValue('Menunggu Truk');
    } else if (perluDiteruskan === 'Tidak') {
      headerSheet.getRange(rowIdx, statusPusatCol + 1).setValue('');
    }
  }

  hapusDetailByHeaderId_(id);
  const detailSheet = getSheet_(SHEET_DETAIL);
  payload.details.forEach(function (d, idx) {
    tulisDetailRow_(detailSheet, detailSheet.getLastRow() + 1, {
      idSuratJalan: id,
      no: idx + 1,
      noBukti: d.noBukti,
      deskripsi: d.deskripsi,
      qty: d.qty,
      satuan: d.satuan,
      keterangan: d.keterangan
    });
  });

  return { success: true };
}

/* ===================== TANDAI STATUS FISIK PER ITEM ===================== */
export function updateStatusFisikDetail(idDetail, statusBaru, role, username) {
  if (role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa menandai status fisik barang.' };
  }

  const detailSheet = getSheet_(SHEET_DETAIL);
  const data = detailSheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID Detail');
  const idHeaderCol = headers.indexOf('ID Surat Jalan');
  const statusCol = headers.indexOf('Status Fisik');
  const diterimaOlehCol = headers.indexOf('Diterima Oleh');
  const waktuDiterimaCol = headers.indexOf('Waktu Diterima');

  const kolomHilang = [];
  if (idCol === -1) kolomHilang.push('ID Detail');
  if (idHeaderCol === -1) kolomHilang.push('ID Surat Jalan');
  if (statusCol === -1) kolomHilang.push('Status Fisik');
  if (diterimaOlehCol === -1) kolomHilang.push('Diterima Oleh');
  if (waktuDiterimaCol === -1) kolomHilang.push('Waktu Diterima');
  if (kolomHilang.length > 0) {
    return { success: false, message: 'Kolom berikut belum ada di sheet DETAIL_SURAT_JALAN: ' + kolomHilang.join(', ') + '. Tambahkan kolom ini di baris header (persis sama namanya) lalu coba lagi.' };
  }

  let rowIdx = -1;
  let idSuratJalan = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === idDetail) {
      rowIdx = i + 1;
      idSuratJalan = data[i][idHeaderCol];
      break;
    }
  }
  if (rowIdx === -1) return { success: false, message: 'Baris detail tidak ditemukan.' };

  detailSheet.getRange(rowIdx, statusCol + 1).setValue(statusBaru);
  detailSheet.getRange(rowIdx, diterimaOlehCol + 1).setValue(statusBaru === 'Diterima' ? username : '');
  detailSheet.getRange(rowIdx, waktuDiterimaCol + 1).setValue(statusBaru === 'Diterima' ? new Date() : '');

  const statusHeaderBaru = hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

export function hitungUlangStatusHeader_(idSuratJalan, username) {
  const details = getDetailSuratJalan(idSuratJalan);
  const totalDiterima = details.filter(d => d.statusFisik === 'Diterima').length;

  const header = ambilHeaderById_(idSuratJalan);
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

  const sheet = getSheet_(SHEET_SURAT_JALAN);
  const rowIdx = cariRowIndexById_(sheet, 'ID', idSuratJalan);
  if (rowIdx !== -1) {
    const headers = sheet.getDataRange().getValues()[0];
    const col = headers.indexOf('Status Kirim Cikupa');
    if (col !== -1) sheet.getRange(rowIdx, col + 1).setValue(statusBaru);
    const colUpdateBy = headers.indexOf('Diupdate Oleh');
    if (colUpdateBy !== -1) sheet.getRange(rowIdx, colUpdateBy + 1).setValue(username || '');
    const colUpdateTime = headers.indexOf('Waktu Update');
    if (colUpdateTime !== -1) sheet.getRange(rowIdx, colUpdateTime + 1).setValue(new Date());
  }

  if (statusBaru === 'Diterima Tujuan') {
    tutupEksternalBySJ_(idSuratJalan);
  } else {
    pendingkanEksternalBySJ_(idSuratJalan);
  }

  return statusBaru;
}

/* ===================== SIMPAN PENERIMAAN MASSAL ===================== */
export function simpanPenerimaanBarang(idSuratJalan, items, role, username) {
  if (role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa menyimpan penerimaan barang.' };
  }
  if (!items || !items.length) {
    return { success: false, message: 'Tidak ada item yang dikirim.' };
  }

  const detailSheet = getSheet_(SHEET_DETAIL);
  const data = detailSheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID Detail');
  const statusCol = headers.indexOf('Status Fisik');
  const diterimaOlehCol = headers.indexOf('Diterima Oleh');
  const waktuDiterimaCol = headers.indexOf('Waktu Diterima');

  if (idCol === -1 || statusCol === -1 || diterimaOlehCol === -1 || waktuDiterimaCol === -1) {
    return { success: false, message: 'Kolom STATUS FISIK / DITERIMA OLEH / WAKTU DITERIMA belum ada di sheet.' };
  }

  const rowMap = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol]) rowMap[data[i][idCol]] = i + 1;
  }

  const now = new Date();
  items.forEach(function (item) {
    const rowIdx = rowMap[item.idDetail];
    if (!rowIdx) return;
    const statusBaru = item.diterima ? 'Diterima' : 'Belum Diterima';
    detailSheet.getRange(rowIdx, statusCol + 1).setValue(statusBaru);
    detailSheet.getRange(rowIdx, diterimaOlehCol + 1).setValue(item.diterima ? username : '');
    detailSheet.getRange(rowIdx, waktuDiterimaCol + 1).setValue(item.diterima ? now : '');
  });

  const statusHeaderBaru = hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

/* ===================== BATAL PENERIMAAN ===================== */
export function batalkanPenerimaan(idSuratJalan, role, username) {
  if (role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa membatalkan status penerimaan.' };
  }

  const detailSheet = getSheet_(SHEET_DETAIL);
  const data = detailSheet.getDataRange().getValues();
  const headers = data[0];
  const idHeaderCol = headers.indexOf('ID Surat Jalan');
  const statusCol = headers.indexOf('Status Fisik');
  const diterimaOlehCol = headers.indexOf('Diterima Oleh');
  const waktuDiterimaCol = headers.indexOf('Waktu Diterima');

  const kolomHilang = [];
  if (idHeaderCol === -1) kolomHilang.push('ID Surat Jalan');
  if (statusCol === -1) kolomHilang.push('Status Fisik');
  if (diterimaOlehCol === -1) kolomHilang.push('Diterima Oleh');
  if (waktuDiterimaCol === -1) kolomHilang.push('Waktu Diterima');
  if (kolomHilang.length > 0) {
    return { success: false, message: 'Kolom berikut belum ada di sheet DETAIL_SURAT_JALAN: ' + kolomHilang.join(', ') + '. Tambahkan kolom ini di baris header (persis sama namanya) lalu coba lagi.' };
  }

  let jumlahDireset = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idHeaderCol] === idSuratJalan) {
      detailSheet.getRange(i + 1, statusCol + 1).setValue('Belum Diterima');
      detailSheet.getRange(i + 1, diterimaOlehCol + 1).setValue('');
      detailSheet.getRange(i + 1, waktuDiterimaCol + 1).setValue('');
      jumlahDireset++;
    }
  }

  if (jumlahDireset === 0) return { success: false, message: 'Tidak ada detail barang ditemukan untuk surat jalan ini.' };

  const statusHeaderBaru = hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

/* ===================== TERIMA BARANG OLEH TUJUAN AKHIR ===================== */
export function terimaBarangTujuan(idSuratJalan, items, role, username, cabangUser) {
  if (role === 'admin') {
    return { success: false, message: 'Admin Pusat gunakan fitur "Penerimaan Barang" di daftar surat jalan.' };
  }

  const header = ambilHeaderById_(idSuratJalan);
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

  const detailSheet = getSheet_(SHEET_DETAIL);
  const data = detailSheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID Detail');
  const idHeaderCol = headers.indexOf('ID Surat Jalan');
  const statusCol = headers.indexOf('Status Fisik');
  const diterimaOlehCol = headers.indexOf('Diterima Oleh');
  const waktuDiterimaCol = headers.indexOf('Waktu Diterima');

  const kolomHilang = [];
  if (idCol === -1) kolomHilang.push('ID Detail');
  if (idHeaderCol === -1) kolomHilang.push('ID Surat Jalan');
  if (statusCol === -1) kolomHilang.push('Status Fisik');
  if (diterimaOlehCol === -1) kolomHilang.push('Diterima Oleh');
  if (waktuDiterimaCol === -1) kolomHilang.push('Waktu Diterima');
  if (kolomHilang.length > 0) {
    return { success: false, message: 'Kolom berikut belum ada di sheet DETAIL_SURAT_JALAN: ' + kolomHilang.join(', ') + '. Tambahkan kolom ini di baris header (persis sama namanya) lalu coba lagi.' };
  }

  const rowMap = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][idHeaderCol] === idSuratJalan && data[i][idCol]) {
      rowMap[data[i][idCol]] = i + 1;
    }
  }

  const now = new Date();
  items.forEach(function (item) {
    const rowIdx = rowMap[item.idDetail];
    if (!rowIdx) return;
    const statusBaru = item.diterima ? 'Diterima' : 'Belum Diterima';
    detailSheet.getRange(rowIdx, statusCol + 1).setValue(statusBaru);
    detailSheet.getRange(rowIdx, diterimaOlehCol + 1).setValue(item.diterima ? username : '');
    detailSheet.getRange(rowIdx, waktuDiterimaCol + 1).setValue(item.diterima ? now : '');
  });

  const statusHeaderBaru = hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru };
}

/* ===================== TERIMA BARANG DARI EKSTERNAL ===================== */
export function terimaBarangEksternal(idSuratJalan, items, username, externalSource) {
  if (!externalSource || !['RMS KUDUS', 'RMS SAYUNG'].includes(externalSource)) {
    return { success: false, message: 'Sumber eksternal tidak valid. Hanya RMS KUDUS dan RMS SAYUNG yang diizinkan.' };
  }

  const header = ambilHeaderById_(idSuratJalan);
  if (!header) return { success: false, message: 'Data surat jalan tidak ditemukan.' };

  if (!items || !items.length) {
    return { success: false, message: 'Tidak ada item yang dikirim.' };
  }

  const detailSheet = getSheet_(SHEET_DETAIL);
  const data = detailSheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID Detail');
  const idHeaderCol = headers.indexOf('ID Surat Jalan');
  const statusCol = headers.indexOf('Status Fisik');
  const diterimaOlehCol = headers.indexOf('Diterima Oleh');
  const waktuDiterimaCol = headers.indexOf('Waktu Diterima');

  const kolomHilang = [];
  if (idCol === -1) kolomHilang.push('ID Detail');
  if (idHeaderCol === -1) kolomHilang.push('ID Surat Jalan');
  if (statusCol === -1) kolomHilang.push('Status Fisik');
  if (diterimaOlehCol === -1) kolomHilang.push('Diterima Oleh');
  if (waktuDiterimaCol === -1) kolomHilang.push('Waktu Diterima');
  if (kolomHilang.length > 0) {
    return { success: false, message: 'Kolom berikut belum ada di sheet DETAIL_SURAT_JALAN: ' + kolomHilang.join(', ') + '. Tambahkan kolom ini di baris header (persis sama namanya) lalu coba lagi.' };
  }

  const rowMap = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][idHeaderCol] === idSuratJalan && data[i][idCol]) {
      rowMap[data[i][idCol]] = i + 1;
    }
  }

  const now = new Date();
  items.forEach(function (item) {
    const rowIdx = rowMap[item.idDetail];
    if (!rowIdx) return;
    const statusBaru = item.diterima ? 'Diterima' : 'Belum Diterima';
    detailSheet.getRange(rowIdx, statusCol + 1).setValue(statusBaru);
    detailSheet.getRange(rowIdx, diterimaOlehCol + 1).setValue(item.diterima ? username : '');
    detailSheet.getRange(rowIdx, waktuDiterimaCol + 1).setValue(item.diterima ? now : '');
  });

  const statusHeaderBaru = hitungUlangStatusHeader_(idSuratJalan, username);
  return { success: true, statusHeader: statusHeaderBaru, source: externalSource };
}

/* ===================== BUAT PENERIMAAN EKSTERNAL (dari RMS) ===================== */
export function simpanPenerimaanEksternal(payload) {
  if (!payload.sumber || !['KUDUS', 'SAYUNG'].includes(payload.sumber)) {
    return { success: false, message: 'Sumber harus KUDUS atau SAYUNG.' };
  }
  if (!payload.noSurat || !payload.noSurat.trim()) {
    return { success: false, message: 'No Surat wajib diisi.' };
  }
  if (!payload.details || payload.details.length === 0) {
    return { success: false, message: 'Minimal 1 baris detail barang harus diisi.' };
  }
  for (var i = 0; i < payload.details.length; i++) {
    var d = payload.details[i];
    if (!d.deskripsi || !d.qty) {
      return { success: false, message: 'Baris ke-' + (i + 1) + ': Deskripsi dan Qty wajib diisi.' };
    }
    if (!d.tujuanSite) {
      return { success: false, message: 'Baris ke-' + (i + 1) + ': Tujuan wajib diisi.' };
    }
  }

  var sheet = getSheet_(SHEET_PENERIMAAN_EXT);
  var detailSheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var idGroup = Utilities.getUuid();
  var now = new Date();
  var tanggal = payload.tanggal ? new Date(payload.tanggal) : now;

  var dHeaders = detailSheet.getDataRange().getValues()[0];
  var kolomWajibDetail = ['Tujuan Site', 'Status Kirim', 'ID SJ Kirim', 'No SJ Kirim'];
  var kolomHilangDetail = kolomWajibDetail.filter(function (kol) { return dHeaders.indexOf(kol) === -1; });
  if (kolomHilangDetail.length > 0) {
    return { success: false, message: 'Kolom berikut belum ada di sheet DETAIL_PENERIMAAN_SURAT_JALAN: ' + kolomHilangDetail.join(', ') + '. Tambahkan kolom ini di baris header (persis sama namanya) lalu coba lagi.' };
  }

  var hHeaders = sheet.getDataRange().getValues()[0];
  var headerRow = sheet.getLastRow() + 1;
  function setCol(name, value) {
    var col = hHeaders.indexOf(name);
    if (col !== -1) sheet.getRange(headerRow, col + 1).setValue(value);
  }
  setCol('ID', idGroup);
  setCol('No Surat Jalan', payload.noSurat.trim());
  setCol('Tanggal', tanggal);
  setCol('Rms', payload.sumber);
  setCol('No Truk', payload.noTruk || '');
  setCol('Kurir', payload.kurir || '');
  setCol('No Bukti', '');
  setCol('Deskripsi', '');
  setCol('Qty', '');
  setCol('Satuan', '');
  setCol('Keterangan', '');
  setCol('Status Fisik', '');
  setCol('Diterima Oleh', payload.username || '');
  setCol('Waktu Input', now);

  payload.details.forEach(function (d, idx) {
    var dH = detailSheet.getDataRange().getValues()[0];
    var dRow = detailSheet.getLastRow() + 1;
    function writeDetailCol(name, value) {
      var col = dH.indexOf(name);
      if (col !== -1) detailSheet.getRange(dRow, col + 1).setValue(value);
    }

    writeDetailCol('ID Detail', Utilities.getUuid());
    writeDetailCol('ID Surat Jalan', idGroup);
    writeDetailCol('No', idx + 1);
    writeDetailCol('No Bukti', d.noBukti || '');
    writeDetailCol('Deskripsi', d.deskripsi);
    writeDetailCol('Qty', d.qty);
    writeDetailCol('Satuan', d.satuan || '');
    writeDetailCol('Keterangan', d.keterangan || '');
    writeDetailCol('Status Fisik', 'Diterima');
    writeDetailCol('Diterima Oleh', payload.username || '');
    writeDetailCol('Waktu Diterima', now);
    writeDetailCol('Tujuan Site', d.tujuanSite || '');
    writeDetailCol('Status Kirim', 'Open');
    writeDetailCol('ID SJ Kirim', '');
    writeDetailCol('No SJ Kirim', '');
  });

  return { success: true, id: idGroup };
}

/* ===================== UPDATE TAHAP 2: PENGIRIMAN LANJUTAN ===================== */
export function updatePengirimanLanjutan(id, payload) {
  if (payload.role !== 'admin') {
    return { success: false, message: 'Hanya Pusat (admin Cikupa/JKT) yang bisa mengisi data pengiriman lanjutan.' };
  }

  const header = ambilHeaderById_(id);
  if (!header) return { success: false, message: 'Data surat jalan tidak ditemukan.' };
  if (header['Perlu Diteruskan'] !== 'Ya') {
    return { success: false, message: 'Surat jalan ini tidak ditandai untuk diteruskan ke tujuan akhir.' };
  }

  const sheet = getSheet_(SHEET_SURAT_JALAN);
  const rowIdx = cariRowIndexById_(sheet, 'ID', id);
  if (rowIdx === -1) return { success: false, message: 'Data tidak ditemukan.' };

  const headers = sheet.getDataRange().getValues()[0];
  function setIfExist(name, value) {
    const col = headers.indexOf(name);
    if (col !== -1) sheet.getRange(rowIdx, col + 1).setValue(value);
  }
  setIfExist('Tanggal Kirim Lanjutan', payload.tanggalKirimLanjutan || '');
  setIfExist('No Truk', payload.noTruk || '');
  setIfExist('Sopir', payload.sopir || '');
  setIfExist('Status Kirim Pusat', payload.statusKirimPusat || 'Menunggu Truk');
  setIfExist('Diupdate Oleh', payload.username || '');
  setIfExist('Waktu Update', new Date());

  return { success: true };
}

/* ===================== DELETE ===================== */
export function deleteSuratJalan(id, role, cabang) {
  const header = ambilHeaderById_(id);
  const izin = cekIzinUbah_(header, role, cabang);
  if (!izin.ok) return { success: false, message: izin.message };

  kembalikanEksternalOpen_(id);

  const headerSheet = getSheet_(SHEET_SURAT_JALAN);
  const rowIdx = cariRowIndexById_(headerSheet, 'ID', id);
  if (rowIdx === -1) return { success: false, message: 'Data tidak ditemukan.' };

  hapusDetailByHeaderId_(id);
  headerSheet.deleteRow(rowIdx);

  return { success: true };
}

/* ===================== PENERIMAAN EKSTERNAL ===================== */
export function getDaftarPenerimaanEksternal() {
  try {
    const headerData = sheetToObjects_(getSheet_(SHEET_PENERIMAAN_EXT));
    const detailData = sheetToObjects_(getSheet_(SHEET_DETAIL_PENERIMAAN_EXT));

    const detailByHeader: Record<string, any[]> = {};
    detailData.forEach(function (d) {
      const hid = String(d['ID Surat Jalan'] || '').trim();
      if (!hid) return;
      if (!detailByHeader[hid]) detailByHeader[hid] = [];
      detailByHeader[hid].push({
        idDetail: d['ID Detail'] || '',
        no: d['No'] || 0,
        noBukti: d['No Bukti'] || '',
        deskripsi: d['Deskripsi'] || '',
        qty: d['Qty'] || 0,
        satuan: d['Satuan'] || '',
        keterangan: d['Keterangan'] || '',
        statusFisik: d['Status Fisik'] || 'Belum Diterima',
        diterimaOleh: d['Diterima Oleh'] || '',
        waktuDiterima: safeFormatDate(d['Waktu Diterima'], 'dd/MM/yyyy HH:mm'),
        tujuanSite: d['Tujuan Site'] || '',
        statusKirim: d['Status Kirim'] || 'Open',
        idSJKirim: d['ID SJ Kirim'] || '',
        noSJKirim: d['No SJ Kirim'] || ''
      });
    });

    const result: any[] = [];
    headerData.forEach(function (r) {
      const id = String(r['ID'] || '').trim();
      if (!id) return;
      if (result.find(x => x.id === id)) return;
      const items = detailByHeader[id] || [];
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
      var da = new Date(String(b.waktuInput || ''));
      var db = new Date(String(a.waktuInput || ''));
      return (isNaN(da.getTime()) ? 0 : da.getTime()) - (isNaN(db.getTime()) ? 0 : db.getTime());
    });
    return result;
  } catch (err: any) {
    Logger.log('ERROR getDaftarPenerimaanEksternal: ' + err.message);
    throw new Error('Gagal memuat daftar penerimaan eksternal: ' + err.message);
  }
}

export function hapusPenerimaanEksternal(id) {
  var sheet = getSheet_(SHEET_PENERIMAAN_EXT);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ID');
  if (idCol === -1) return { success: false, message: 'Kolom ID tidak ditemukan.' };

  var rowsToDelete = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.reverse().forEach(function (rowIdx) {
    sheet.deleteRow(rowIdx);
  });

  var dSheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var dData = dSheet.getDataRange().getValues();
  var dHeaders = dData[0];
  var dIdCol = dHeaders.indexOf('ID Surat Jalan');
  if (dIdCol !== -1) {
    var dRowsToDelete = [];
    for (var j = 1; j < dData.length; j++) {
      if (String(dData[j][dIdCol]).trim() === String(id).trim()) {
        dRowsToDelete.push(j + 1);
      }
    }
    dRowsToDelete.reverse().forEach(function (rowIdx) {
      dSheet.deleteRow(rowIdx);
    });
  }

  return { success: true };
}

/* ===================== DETAIL VIEW PENERIMAAN EKSTERNAL ===================== */
export function getPenerimaanEksternalDetail(id) {
  try {
    var headerData = sheetToObjects_(getSheet_(SHEET_PENERIMAAN_EXT));
    var headerRow = headerData.find(function (r) { return String(r['ID'] || '').trim() === String(id).trim(); });
    if (!headerRow) return { success: false, message: 'Data tidak ditemukan.' };

    var detailData = sheetToObjects_(getSheet_(SHEET_DETAIL_PENERIMAAN_EXT));
    var items = detailData
      .filter(function (d) { return String(d['ID Surat Jalan'] || '').trim() === String(id).trim(); })
      .sort(function (a, b) { return Number(a['No'] || 0) - Number(b['No'] || 0); })
      .map(function (d) {
        return {
          idDetail: d['ID Detail'] || '',
          no: d['No'] || 0,
          noBukti: d['No Bukti'] || '',
          deskripsi: d['Deskripsi'] || '',
          qty: d['Qty'] || 0,
          satuan: d['Satuan'] || '',
          keterangan: d['Keterangan'] || '',
          statusFisik: d['Status Fisik'] || 'Belum Diterima',
          diterimaOleh: d['Diterima Oleh'] || '',
          waktuDiterima: safeFormatDate(d['Waktu Diterima'], 'dd/MM/yyyy HH:mm'),
          tujuanSite: d['Tujuan Site'] || '',
          statusKirim: d['Status Kirim'] || 'Open',
          idSJKirim: d['ID SJ Kirim'] || '',
          noSJKirim: d['No SJ Kirim'] || ''
        };
      });

    return {
      success: true,
      header: {
        id: id,
        noSuratJalan: headerRow['No Surat Jalan'] || '',
        tanggal: safeFormatDate(headerRow['Tanggal'], 'yyyy-MM-dd'),
        rms: headerRow['Rms'] || '',
        noTruk: headerRow['No Truk'] || '',
        kurir: headerRow['Kurir'] || '',
        diterimaOleh: headerRow['Diterima Oleh'] || '',
        waktuInput: safeFormatDate(headerRow['Waktu Input'], 'dd/MM/yyyy HH:mm')
      },
      items: items
    };
  } catch (err: any) {
    Logger.log('ERROR getPenerimaanEksternalDetail: ' + err.message);
    throw new Error('Gagal memuat detail: ' + err.message);
  }
}

/* ===================== UPDATE / EDIT PENERIMAAN EKSTERNAL ===================== */
export function updatePenerimaanEksternal(id, payload) {
  if (!payload.noSurat || !payload.noSurat.trim()) {
    return { success: false, message: 'No Surat Jalan wajib diisi.' };
  }
  if (!payload.details || payload.details.length === 0) {
    return { success: false, message: 'Minimal 1 baris detail barang harus diisi.' };
  }

  var hSheet = getSheet_(SHEET_PENERIMAAN_EXT);
  var hData = hSheet.getDataRange().getValues();
  var hHeaders = hData[0];
  var hIdCol = hHeaders.indexOf('ID');
  var hRowIdx = -1;
  for (var i = 1; i < hData.length; i++) {
    if (String(hData[i][hIdCol]).trim() === String(id).trim()) {
      hRowIdx = i + 1;
      break;
    }
  }
  if (hRowIdx === -1) return { success: false, message: 'Data tidak ditemukan.' };

  function setHCol(name, value) {
    var col = hHeaders.indexOf(name);
    if (col !== -1) hSheet.getRange(hRowIdx, col + 1).setValue(value);
  }
  setHCol('No Surat Jalan', payload.noSurat.trim());
  if (payload.tanggal) setHCol('Tanggal', new Date(payload.tanggal));
  if (payload.sumber) setHCol('Rms', payload.sumber);
  setHCol('No Truk', payload.noTruk || '');
  setHCol('Kurir', payload.kurir || '');

  var dSheet = getSheet_(SHEET_DETAIL_PENERIMAAN_EXT);
  var dData = dSheet.getDataRange().getValues();
  var dHeaders = dData[0];
  var dIdCol = dHeaders.indexOf('ID Surat Jalan');

  var statusKirimLama: Record<string, { statusKirim: string; idSJKirim: string; noSJKirim: string }> = {};
  if (dIdCol !== -1) {
    var nbCol = dHeaders.indexOf('No Bukti');
    var skCol = dHeaders.indexOf('Status Kirim');
    var idSJCol = dHeaders.indexOf('ID SJ Kirim');
    var noSJCol = dHeaders.indexOf('No SJ Kirim');
    for (var p = 1; p < dData.length; p++) {
      if (String(dData[p][dIdCol]).trim() === String(id).trim()) {
        var buktiKey = nbCol !== -1 ? String(dData[p][nbCol]).trim() : '';
        var lamaStatus = skCol !== -1 ? String(dData[p][skCol] || '') : '';
        if (buktiKey && (lamaStatus === 'Pending' || lamaStatus === 'Close')) {
          statusKirimLama[buktiKey] = {
            statusKirim: lamaStatus,
            idSJKirim: idSJCol !== -1 ? String(dData[p][idSJCol] || '') : '',
            noSJKirim: noSJCol !== -1 ? String(dData[p][noSJCol] || '') : ''
          };
        }
      }
    }
  }

  var dRowsToDelete = [];
  for (var j = 1; j < dData.length; j++) {
    if (String(dData[j][dIdCol]).trim() === String(id).trim()) {
      dRowsToDelete.push(j + 1);
    }
  }
  dRowsToDelete.reverse().forEach(function (rowIdx) {
    dSheet.deleteRow(rowIdx);
  });

  var now = new Date();
  payload.details.forEach(function (d, idx) {
    var ddHeaders = dSheet.getDataRange().getValues()[0];
    var dRow = dSheet.getLastRow() + 1;
    function writeDetailCol(name, value) {
      var col = ddHeaders.indexOf(name);
      if (col !== -1) dSheet.getRange(dRow, col + 1).setValue(value);
    }
    var kirimPertahankan = statusKirimLama[String(d.noBukti || '').trim()];
    writeDetailCol('ID Detail', Utilities.getUuid());
    writeDetailCol('ID Surat Jalan', id);
    writeDetailCol('No', idx + 1);
    writeDetailCol('No Bukti', d.noBukti || '');
    writeDetailCol('Deskripsi', d.deskripsi);
    writeDetailCol('Qty', d.qty);
    writeDetailCol('Satuan', d.satuan || '');
    writeDetailCol('Keterangan', d.keterangan || '');
    writeDetailCol('Status Fisik', d.statusFisik || 'Diterima');
    writeDetailCol('Diterima Oleh', d.diterimaOleh || payload.username || '');
    writeDetailCol('Waktu Diterima', d.waktuDiterima || now);
    writeDetailCol('Tujuan Site', d.tujuanSite || '');
    if (kirimPertahankan) {
      writeDetailCol('Status Kirim', kirimPertahankan.statusKirim);
      writeDetailCol('ID SJ Kirim', kirimPertahankan.idSJKirim);
      writeDetailCol('No SJ Kirim', kirimPertahankan.noSJKirim);
    } else {
      writeDetailCol('Status Kirim', d.statusKirim || 'Open');
      writeDetailCol('ID SJ Kirim', d.idSJKirim || '');
      writeDetailCol('No SJ Kirim', d.noSJKirim || '');
    }
  });

  return { success: true };
}

/* ===================== KIRIMAN PENDING & OPEN PENERIMAAN EKSTERNAL ===================== */
export function getDaftarKirimanPending(role, cabang) {
  try {
    var detailData = sheetToObjects_(getSheet_(SHEET_DETAIL_PENERIMAAN_EXT));
    var headerData = sheetToObjects_(getSheet_(SHEET_PENERIMAAN_EXT));

    var result = [];
    detailData.forEach(function (d) {
      var statusKirim = d['Status Kirim'] || 'Open';
      if (statusKirim === 'Close') return;

      var tujuan = d['Tujuan Site'] || '';
      var cabangFilter = cabang ? String(cabang).toUpperCase() : '';
      if (role !== 'admin' && cabangFilter && tujuan.toUpperCase() !== cabangFilter) return;

      var headerId = String(d['ID Surat Jalan'] || '').trim();
      var headerInfo = headerData.find(function (h) {
        return String(h['ID'] || '').trim() === headerId;
      });

      result.push({
        idDetail: d['ID Detail'] || '',
        noBukti: d['No Bukti'] || '',
        deskripsi: d['Deskripsi'] || '',
        qty: d['Qty'] || 0,
        satuan: d['Satuan'] || '',
        keterangan: d['Keterangan'] || '',
        tujuanSite: tujuan,
        statusKirim: statusKirim,
        noSJKirim: d['No SJ Kirim'] || '',
        idSJKirim: d['ID SJ Kirim'] || '',
        sumber: headerInfo ? (headerInfo['Rms'] || '') : '',
        noSuratPenerimaan: headerInfo ? (headerInfo['No Surat Jalan'] || '') : '',
        tanggalPenerimaan: headerInfo ? safeFormatDate(headerInfo['Tanggal'], 'dd/MM/yyyy') : ''
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

export function getOpenPenerimaanEksternalUntukTujuan(tujuanSite) {
  try {
    var detailData = sheetToObjects_(getSheet_(SHEET_DETAIL_PENERIMAAN_EXT));
    var headerData = sheetToObjects_(getSheet_(SHEET_PENERIMAAN_EXT));

    var tujuanFilter = String(tujuanSite || '').toUpperCase();
    var result = [];
    detailData.forEach(function (d) {
      if ((d['Status Kirim'] || 'Open') !== 'Open') return;
      var tujuan = (d['Tujuan Site'] || '').toUpperCase();
      if (tujuanFilter && tujuan !== tujuanFilter) return;

      var headerId = String(d['ID Surat Jalan'] || '').trim();
      var headerInfo = headerData.find(function (h) {
        return String(h['ID'] || '').trim() === headerId;
      });

      result.push({
        idDetail: d['ID Detail'] || '',
        noBukti: d['No Bukti'] || '',
        deskripsi: d['Deskripsi'] || '',
        qty: d['Qty'] || 0,
        satuan: d['Satuan'] || '',
        keterangan: d['Keterangan'] || '',
        tujuanSite: d['Tujuan Site'] || '',
        sumber: headerInfo ? (headerInfo['Rms'] || '') : '',
        noSuratPenerimaan: headerInfo ? (headerInfo['No Surat Jalan'] || '') : ''
      });
    });
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
    .filter(r => r[siteCol])
    .map(r => ({ site: r[siteCol], wilayah: wilayahCol !== -1 ? r[wilayahCol] : '' }));
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

