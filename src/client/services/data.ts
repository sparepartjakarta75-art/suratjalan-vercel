import type { SuratJalanHeader, DetailBarang, Cabang, JenisBarang, Alamat } from '../types';
import { Api } from '../utils/api-client';
import { AuthService } from './auth';

let daftarCache: SuratJalanHeader[] = [];
let detailCache: Record<string, DetailBarang[]> = {};

export const DataService = {
  // ===== SURAT JALAN =====
  loadDaftarSuratJalan: async (): Promise<SuratJalanHeader[]> => {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('User tidak login');
    
    daftarCache = await Api.getDaftarSuratJalan(user.role, user.cabang);
    // Clear detail cache saat load ulang
    Object.keys(detailCache).forEach(key => delete detailCache[key]);
    return daftarCache;
  },

  getDaftarCache: (): SuratJalanHeader[] => daftarCache,

  getDetailSuratJalan: async (id: string): Promise<DetailBarang[]> => {
    if (detailCache[id]) return detailCache[id];
    
    const details = await Api.getDetailSuratJalan(id);
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
  loadCabangList: (): Promise<Cabang[]> => Api.getCabangList(),

  loadJenisBarangList: (): Promise<JenisBarang[]> => Api.getJenisBarangList(),

  loadAlamatList: (): Promise<Alamat[]> => Api.getAlamatList(),

  // ===== EDIT =====
  getSuratJalanForEdit: async (id: string) => {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('User tidak login');
    const result = await Api.getSuratJalanForEdit(id, user.role, user.cabang);
    if (!result || !result.success) throw new Error(result?.message || 'Gagal memuat data edit');
    return result;
  },

  // ===== CRUD OPERATIONS =====
  saveSuratJalan: (payload: any) => Api.simpanSuratJalan(payload),

  updateSuratJalan: (id: string, payload: any) => Api.updateSuratJalan(id, payload),

  deleteSuratJalan: async (id: string, role?: string, cabang?: string) => {
    const result = await Api.deleteSuratJalan(id, role || '', cabang || '');
    if (!result.success) throw new Error(result.message);
    return result;
  },

  // ===== OPERATIONS =====
  updateStatusFisikDetail: (idDetail: string, status: string, role: string, username: string) =>
    Api.updateStatusFisikDetail(idDetail, status, role, username),

  batalTerima: (id: string, role: string, username: string) =>
    Api.batalTerima(id, role, username),

  batalkanPenerimaan: async (id: string, role: string, username: string) => {
    const result = await Api.batalkanPenerimaan(id, role, username);
    if (!result.success) throw new Error(result.message);
    return result;
  },

  updatePengirimanLanjutan: async (id: string, payload: any) => {
    const result = await Api.updatePengirimanLanjutan(id, payload);
    if (!result.success) throw new Error(result.message);
    return result;
  },

  simpanPenerimaanBarang: (idSuratJalan: string, items: any[], role: string, username: string) =>
    Api.simpanPenerimaanBarang(idSuratJalan, items, role, username),

  // Penerimaan oleh tujuan akhir (cabang)
  loadDaftarSuratJalanUntukTujuan: async (cabangTujuan: string) => {
    const list = await Api.getDaftarSuratJalanUntukTujuan(cabangTujuan);
    return list;
  },

  terimaBarangTujuan: (idSuratJalan: string, items: any[], role: string, username: string, cabangUser: string) =>
    Api.terimaBarangTujuan(idSuratJalan, items, role, username, cabangUser),

  terimaBarangEksternal: (idSuratJalan: string, items: any[], username: string, externalSource: string) =>
    Api.terimaBarangEksternal(idSuratJalan, items, username, externalSource),

  simpanPenerimaanEksternal: (payload: any) =>
    Api.simpanPenerimaanEksternal(payload),

  loadDaftarPenerimaanEksternal: async () => {
    return await Api.getDaftarPenerimaanEksternal();
  },

  hapusPenerimaanEksternal: (id: string) =>
    Api.hapusPenerimaanEksternal(id),

  getPenerimaanEksternalDetail: (id: string) =>
    Api.getPenerimaanEksternalDetail(id),

  updatePenerimaanEksternal: (id: string, payload: any) =>
    Api.updatePenerimaanEksternal(id, payload),

  cetakPenerimaanEksternal: (id: string) =>
    Api.cetakPenerimaanEksternal(id),

  loadDaftarKirimanPending: async () => {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('User tidak login');
    return await Api.getDaftarKirimanPending(user.role, user.cabang);
  },

  loadOpenPenerimaanEksternalUntukTujuan: (tujuanSite: string) =>
    Api.getOpenPenerimaanEksternalUntukTujuan(tujuanSite),

  generatePdf: (id: string, nama: string) =>
    Api.buatPdfSuratJalan(id, nama),

  invalidateDaftarCache: () => {
    daftarCache = [];
    Object.keys(detailCache).forEach(key => delete detailCache[key]);
  },
};
