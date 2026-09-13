import type { SuratJalanHeader, DetailBarang, Cabang, JenisBarang, Alamat } from '../types';
import { GasAPI } from '../utils/gas-wrapper';
import { AuthService } from './auth';

let daftarCache: SuratJalanHeader[] = [];
let detailCache: Record<string, DetailBarang[]> = {};

export const DataService = {
  // ===== SURAT JALAN =====
  loadDaftarSuratJalan: async (): Promise<SuratJalanHeader[]> => {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('User tidak login');
    
    daftarCache = await GasAPI.getDaftarSuratJalan(user.role, user.cabang);
    // Clear detail cache saat load ulang
    Object.keys(detailCache).forEach(key => delete detailCache[key]);
    return daftarCache;
  },

  getDaftarCache: (): SuratJalanHeader[] => daftarCache,

  getDetailSuratJalan: async (id: string): Promise<DetailBarang[]> => {
    if (detailCache[id]) return detailCache[id];
    
    const details = await GasAPI.getDetailSuratJalan(id);
    detailCache[id] = details;
    return details;
  },

  filterDaftar: (status?: string, search?: string): SuratJalanHeader[] => {
    let filtered = [...daftarCache];

    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.noSuratJalan.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  },

  // ===== REFERENSI DATA =====
  loadCabangList: (): Promise<Cabang[]> => GasAPI.getCabangList(),

  loadJenisBarangList: (): Promise<JenisBarang[]> => GasAPI.getJenisBarangList(),

  loadAlamatList: (): Promise<Alamat[]> => GasAPI.getAlamatList(),

  // ===== EDIT =====
  getSuratJalanForEdit: async (id: string) => {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('User tidak login');
    const result = await GasAPI.getSuratJalanForEdit(id, user.role, user.cabang);
    if (!result || !result.success) throw new Error(result?.message || 'Gagal memuat data edit');
    return result;
  },

  // ===== CRUD OPERATIONS =====
  saveSuratJalan: (payload: any) => GasAPI.simpanSuratJalan(payload),

  updateSuratJalan: (id: string, payload: any) => GasAPI.updateSuratJalan(id, payload),

  deleteSuratJalan: async (id: string, role?: string, cabang?: string) => {
    const result = await GasAPI.deleteSuratJalan(id, role || '', cabang || '');
    if (!result.success) throw new Error(result.message);
    return result;
  },

  // ===== OPERATIONS =====
  updateStatusFisikDetail: (idDetail: string, status: string, role: string, username: string) =>
    GasAPI.updateStatusFisikDetail(idDetail, status, role, username),

  batalTerima: (id: string, role: string, username: string) =>
    GasAPI.batalTerima(id, role, username),

  batalkanPenerimaan: async (id: string, role: string, username: string) => {
    const result = await GasAPI.batalkanPenerimaan(id, role, username);
    if (!result.success) throw new Error(result.message);
    return result;
  },

  updatePengirimanLanjutan: async (id: string, payload: any) => {
    const result = await GasAPI.updatePengirimanLanjutan(id, payload);
    if (!result.success) throw new Error(result.message);
    return result;
  },

  simpanPenerimaanBarang: (idSuratJalan: string, items: any[], role: string, username: string) =>
    GasAPI.simpanPenerimaanBarang(idSuratJalan, items, role, username),

  // Penerimaan oleh tujuan akhir (cabang)
  loadDaftarSuratJalanUntukTujuan: async (cabangTujuan: string) => {
    const list = await GasAPI.getDaftarSuratJalanUntukTujuan(cabangTujuan);
    return list;
  },

  terimaBarangTujuan: (idSuratJalan: string, items: any[], role: string, username: string, cabangUser: string) =>
    GasAPI.terimaBarangTujuan(idSuratJalan, items, role, username, cabangUser),

  terimaBarangEksternal: (idSuratJalan: string, items: any[], username: string, externalSource: string) =>
    GasAPI.terimaBarangEksternal(idSuratJalan, items, username, externalSource),

  simpanPenerimaanEksternal: (payload: any) =>
    GasAPI.simpanPenerimaanEksternal(payload),

  loadDaftarPenerimaanEksternal: async () => {
    return await GasAPI.getDaftarPenerimaanEksternal();
  },

  hapusPenerimaanEksternal: (id: string) =>
    GasAPI.hapusPenerimaanEksternal(id),

  getPenerimaanEksternalDetail: (id: string) =>
    GasAPI.getPenerimaanEksternalDetail(id),

  updatePenerimaanEksternal: (id: string, payload: any) =>
    GasAPI.updatePenerimaanEksternal(id, payload),

  cetakPenerimaanEksternal: (id: string) =>
    GasAPI.cetakPenerimaanEksternal(id),

  loadDaftarKirimanPending: async () => {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('User tidak login');
    return await GasAPI.getDaftarKirimanPending(user.role, user.cabang);
  },

  loadOpenPenerimaanEksternalUntukTujuan: (tujuanSite: string) =>
    GasAPI.getOpenPenerimaanEksternalUntukTujuan(tujuanSite),

  generatePdf: (id: string, nama: string) =>
    GasAPI.buatPdfSuratJalan(id, nama),

  invalidateDaftarCache: () => {
    daftarCache = [];
    Object.keys(detailCache).forEach(key => delete detailCache[key]);
  },
};
