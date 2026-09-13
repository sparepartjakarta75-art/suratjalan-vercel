/**
 * Type definitions untuk aplikasi Surat Jalan
 */

export interface User {
  success: boolean;
  username: string;
  nama: string;
  cabang: string;
  role: 'admin' | 'cabang';
  pengirim: string;
  alamatLengkap: {
    site: string;
    wilayah: string;
    pic: string;
    dept: string;
    alamat: string;
    kelurahan: string;
    kecamatan: string;
    kota: string;
    tlp: string;
  } | null;
}

export interface SuratJalanHeader {
  id: string;
  noSuratJalan: string;
  tanggal: string;
  cabangAsal: string;
  cabangTujuan: string;
  kodeJenis: string;
  dikirimVia?: string;
  totalBarang: number;
  status: string;
  dibuatOleh: string;
  perluDiteruskan: 'Ya' | 'Tidak';
  tujuanAkhir?: string;
  statusKirimPusat?: string;
  noTruk?: string;
  sopir?: string;
}

export interface DetailBarang {
  idDetail: string;
  noBukti?: string;
  deskripsi: string;
  qty: number;
  satuan?: string;
  keterangan?: string;
  statusFisik: 'Belum Diterima' | 'Diterima';
  diterimaOleh?: string;
  waktuDiterima?: string;
}

export interface Cabang {
  Kode: string;
  'Nama Cabang': string;
}

export interface JenisBarang {
  Kode: string;
  'Nama Jenis': string;
}

export interface Alamat {
  site: string;
  wilayah?: string;
}

export type StatusKirimEksternal = 'Open' | 'Pending' | 'Close';

export interface KirimanPendingItem {
  idDetail: string;
  noBukti: string;
  deskripsi: string;
  qty: number;
  satuan: string;
  keterangan: string;
  tujuanSite: string;
  statusKirim: StatusKirimEksternal;
  noSJKirim: string;
  idSJKirim: string;
  sumber: string;
  noSuratPenerimaan: string;
  tanggalPenerimaan: string;
}

export interface OpenPenerimaanEksternalItem {
  idDetail: string;
  noBukti: string;
  deskripsi: string;
  qty: number;
  satuan: string;
  keterangan: string;
  tujuanSite: string;
  sumber: string;
  noSuratPenerimaan: string;
}

export interface MessageNotification {
  type: 'success' | 'error' | 'info';
  text: string;
}
