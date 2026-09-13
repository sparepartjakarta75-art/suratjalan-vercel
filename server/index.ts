/**
 * ============================================================
 * INDEX.TS — RPC dispatcher
 * ============================================================
 * Menerima { fn, args } dari client (api-client fetch ke /api/rpc),
 * memuat virtual store, membubuhkan identitas user dari token sesi
 * (mengganti role/cabang/username yang dikirim client agar tidak
 * bisa dipalsukan), menjalankan handler, lalu mem-flush perubahan.
 * ============================================================
 */

import {
  login as authLogin,
  createSession,
  validateSession,
  gantiPassword,
  destroySession,
  UserInfo,
} from './auth.js';
import { buatPdfSuratJalan, buatPdfPenerimaanEksternal } from './pdf.js';
import * as core from './core.js';

export class RpcError extends Error {}

/** Fungsi mana yang boleh diakses tanpa sesi login. */
const PUBLIC_FNS: Record<string, boolean> = {
  login: true,
  health: true,
};

const IMPLEMENTED: Record<string, string> = {
  login: 'login',
  gantiPassword: 'gantiPassword',
  getDaftarSuratJalan: 'getDaftarSuratJalan',
  getDetailSuratJalan: 'getDetailSuratJalan',
  getSuratJalanForEdit: 'getSuratJalanForEdit',
  getCabangList: 'getCabangList',
  getJenisBarangList: 'getJenisBarangList',
  getAlamatList: 'getAlamatList',
  simpanSuratJalan: 'simpanSuratJalan',
  updateSuratJalan: 'updateSuratJalan',
  hapusSuratJalan: 'deleteSuratJalan',
  deleteSuratJalan: 'deleteSuratJalan',
  updateStatusFisikDetail: 'updateStatusFisikDetail',
  batalTerima: 'batalTerima',
  batalkanPenerimaan: 'batalkanPenerimaan',
  updatePengirimanLanjutan: 'updatePengirimanLanjutan',
  buatPdfSuratJalan: 'buatPdfSuratJalan',
  bukaModalLanjutan: 'bukaModalLanjutan',
  getAlamatFullList: 'getAlamatFullList',
  simpanAlamat: 'simpanAlamat',
  hapusAlamat: 'hapusAlamat',
  simpanPenerimaanBarang: 'simpanPenerimaanBarang',
  getDaftarSuratJalanUntukTujuan: 'getDaftarSuratJalanUntukTujuan',
  terimaBarangTujuan: 'terimaBarangTujuan',
  terimaBarangEksternal: 'terimaBarangEksternal',
  simpanPenerimaanEksternal: 'simpanPenerimaanEksternal',
  getDaftarPenerimaanEksternal: 'getDaftarPenerimaanEksternal',
  hapusPenerimaanEksternal: 'hapusPenerimaanEksternal',
  getPenerimaanEksternalDetail: 'getPenerimaanEksternalDetail',
  updatePenerimaanEksternal: 'updatePenerimaanEksternal',
  cetakPenerimaanEksternal: 'cetakPenerimaanEksternal',
  getDaftarKirimanPending: 'getDaftarKirimanPending',
  getOpenPenerimaanEksternalUntukTujuan: 'getOpenPenerimaanEksternalUntukTujuan',
  logout: 'logout',
};

/** Override argumen sensitive berdasarkan identitas dari sesi (bukan dari client). */
function overrideArgs(fn: string, args: any[], user: UserInfo): any[] {
  const argsOut = [...args];
  if (user.role !== 'admin') {
    // Batasan tambahan: patch penargetan sesuai cabang user.
    switch (fn) {
      case 'getDaftarSuratJalanUntukTujuan':
        argsOut[0] = user.cabang;
        break;
      case 'getOpenPenerimaanEksternalUntukTujuan':
        argsOut[0] = user.cabang;
        break;
    }
  }
  switch (fn) {
    case 'getDaftarSuratJalan':
    case 'getDaftarKirimanPending':
    case 'getSuratJalanForEdit':
      argsOut[0] = user.role;
      argsOut[1] = user.cabang;
      break;
    case 'deleteSuratJalan':
    case 'hapusSuratJalan':
      argsOut[1] = user.role;
      argsOut[2] = user.cabang;
      break;
    case 'updateStatusFisikDetail':
      argsOut[2] = user.role;
      argsOut[3] = user.username;
      break;
    case 'batalTerima':
    case 'batalkanPenerimaan':
      argsOut[1] = user.role;
      argsOut[2] = user.username;
      break;
    case 'simpanPenerimaanBarang':
      argsOut[2] = user.role;
      argsOut[3] = user.username;
      break;
    case 'terimaBarangTujuan':
      argsOut[2] = user.role;
      argsOut[3] = user.username;
      argsOut[4] = user.cabang;
      break;
    case 'terimaBarangEksternal':
      argsOut[2] = user.username;
      break;
  }
  if (fn === 'simpanSuratJalan' && argsOut[0]) {
    argsOut[0].username = user.username;
  }
  if (fn === 'updateSuratJalan' && argsOut[1]) {
    argsOut[1].role = user.role;
    argsOut[1].cabang = user.cabang;
    argsOut[1].username = user.username;
  }
  if (fn === 'updatePengirimanLanjutan' && argsOut[1]) {
    argsOut[1].role = user.role;
    argsOut[1].username = user.username;
  }
  if (fn === 'simpanPenerimaanEksternal' && argsOut[0]) {
    argsOut[0].username = user.username;
  }
  if (fn === 'updatePenerimaanEksternal' && argsOut[1]) {
    argsOut[1].username = user.username;
  }
  return argsOut;
}

export async function handleRpc(fn: string, args: any[], token: string): Promise<any> {
  const implKey = IMPLEMENTED[fn];
  if (!implKey) throw new RpcError('Fungsi "' + fn + '" tidak dikenal.');

  // ---------- Public endpoint ----------
  if (fn === 'health') {
    return { ok: true };
  }

  if (fn === 'login') {
    const [username, password] = args || [];
    const result = await authLogin(username, password);
    if (result.success) {
      await createSession(result.token, result.username);
    }
    return result;
  }

  // ---------- Butuh sesi ----------
  const user = await validateSession(token);
  if (!user) throw new RpcError('Sesi tidak valid atau sudah kedaluwarsa. Silakan login ulang.');

  if (fn === 'logout') {
    await destroySession(token);
    return { success: true };
  }

  const safeArgs = overrideArgs(fn, args || [], user);

  let result: any;
  switch (implKey) {
    case 'gantiPassword':
      result = await gantiPassword(safeArgs[0]);
      break;

    case 'getDaftarSuratJalan': result = await core.getDaftarSuratJalan(safeArgs[0], safeArgs[1]); break;
    case 'getDetailSuratJalan': result = await core.getDetailSuratJalan(safeArgs[0]); break;
    case 'getSuratJalanForEdit': result = await core.getSuratJalanForEdit(safeArgs[0], safeArgs[1], safeArgs[2]); break;
    case 'getCabangList': result = core.getCabangList(); break;
    case 'getJenisBarangList': result = core.getJenisBarangList(); break;
    case 'getAlamatList': result = core.getAlamatList(); break;
    case 'getAlamatFullList': result = core.getAlamatFullList(); break;
    case 'simpanAlamat': result = await core.simpanAlamat(safeArgs[0]); break;
    case 'hapusAlamat': result = await core.hapusAlamat(safeArgs[0]); break;

    case 'simpanSuratJalan': result = await core.simpanSuratJalan(safeArgs[0]); break;
    case 'updateSuratJalan': result = await core.updateSuratJalan(safeArgs[0], safeArgs[1]); break;
    case 'deleteSuratJalan': result = await core.deleteSuratJalan(safeArgs[0], safeArgs[1], safeArgs[2]); break;
    case 'updateStatusFisikDetail': result = await core.updateStatusFisikDetail(safeArgs[0], safeArgs[1], safeArgs[2], safeArgs[3]); break;
    case 'batalTerima':
    case 'batalkanPenerimaan': result = await core.batalkanPenerimaan(safeArgs[0], safeArgs[1], safeArgs[2]); break;
    case 'updatePengirimanLanjutan': result = await core.updatePengirimanLanjutan(safeArgs[0], safeArgs[1]); break;
    case 'bukaModalLanjutan': result = { success: true }; break;

    case 'simpanPenerimaanBarang': result = await core.simpanPenerimaanBarang(safeArgs[0], safeArgs[1], safeArgs[2], safeArgs[3]); break;
    case 'getDaftarSuratJalanUntukTujuan': result = await core.getDaftarSuratJalanUntukTujuan(safeArgs[0]); break;
    case 'terimaBarangTujuan': result = await core.terimaBarangTujuan(safeArgs[0], safeArgs[1], safeArgs[2], safeArgs[3], safeArgs[4]); break;
    case 'terimaBarangEksternal': result = await core.terimaBarangEksternal(safeArgs[0], safeArgs[1], safeArgs[2], safeArgs[3]); break;

    case 'simpanPenerimaanEksternal': result = await core.simpanPenerimaanEksternal(safeArgs[0]); break;
    case 'getDaftarPenerimaanEksternal': result = await core.getDaftarPenerimaanEksternal(); break;
    case 'hapusPenerimaanEksternal': result = await core.hapusPenerimaanEksternal(safeArgs[0]); break;
    case 'getPenerimaanEksternalDetail': result = await core.getPenerimaanEksternalDetail(safeArgs[0]); break;
    case 'updatePenerimaanEksternal': result = await core.updatePenerimaanEksternal(safeArgs[0], safeArgs[1]); break;
    case 'getDaftarKirimanPending': result = await core.getDaftarKirimanPending(safeArgs[0], safeArgs[1]); break;
    case 'getOpenPenerimaanEksternalUntukTujuan': result = await core.getOpenPenerimaanEksternalUntukTujuan(safeArgs[0]); break;

    case 'buatPdfSuratJalan': result = await buatPdfSuratJalan(safeArgs[0], safeArgs[1] || user.nama); break;
    case 'cetakPenerimaanEksternal': result = await buatPdfPenerimaanEksternal(safeArgs[0]); break;

    default:
      throw new RpcError('Fungsi "' + fn + '" tidak diimplementasikan.');
  }

  return result;
}