/**
 * Api wrapper — fetch-based client for Vercel backend.
 * Keeps the same interface & callApiFunction signature
 * so all existing components & services work without changes.
 */

export function callApiFunction(functionName: string, ...args: any[]): Promise<any> {
  const token = localStorage.getItem('sj_token') || '';
  return fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ fn: functionName, args }),
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    return data.result;
  });
}

export function saveAuthToken(token: string) {
  localStorage.setItem('sj_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('sj_token');
}

export const Api = {
  login: (username: string, password: string) =>
    callApiFunction('login', username, password),

  logout: () =>
    callApiFunction('logout'),

  gantiPassword: (payload: any) =>
    callApiFunction('gantiPassword', payload),

  getDaftarSuratJalan: (role: string, cabang: string) =>
    callApiFunction('getDaftarSuratJalan', role, cabang),

  getDetailSuratJalan: (id: string) =>
    callApiFunction('getDetailSuratJalan', id),

  getSuratJalanForEdit: (id: string, role: string, cabang: string) =>
    callApiFunction('getSuratJalanForEdit', id, role, cabang),

  getCabangList: () =>
    callApiFunction('getCabangList'),

  getJenisBarangList: () =>
    callApiFunction('getJenisBarangList'),

  getAlamatList: () =>
    callApiFunction('getAlamatList'),

  simpanSuratJalan: (payload: any) =>
    callApiFunction('simpanSuratJalan', payload),

  updateSuratJalan: (id: string, payload: any) =>
    callApiFunction('updateSuratJalan', id, payload),

  hapusSuratJalan: (id: string) =>
    callApiFunction('hapusSuratJalan', id),

  deleteSuratJalan: (id: string, role: string, cabang: string) =>
    callApiFunction('deleteSuratJalan', id, role, cabang),

  updateStatusFisikDetail: (idDetail: string, status: string, role: string, username: string) =>
    callApiFunction('updateStatusFisikDetail', idDetail, status, role, username),

  batalTerima: (id: string, role: string, username: string) =>
    callApiFunction('batalTerima', id, role, username),

  batalkanPenerimaan: (id: string, role: string, username: string) =>
    callApiFunction('batalkanPenerimaan', id, role, username),

  updatePengirimanLanjutan: (id: string, payload: any) =>
    callApiFunction('updatePengirimanLanjutan', id, payload),

  buatPdfSuratJalan: (id: string, nama: string) =>
    callApiFunction('buatPdfSuratJalan', id, nama),

  bukaModalLanjutan: (id: string) =>
    callApiFunction('bukaModalLanjutan', id),

  getAlamatFullList: () =>
    callApiFunction('getAlamatFullList'),

  simpanAlamat: (payload: any) =>
    callApiFunction('simpanAlamat', payload),

  hapusAlamat: (site: string) =>
    callApiFunction('hapusAlamat', site),

  simpanPenerimaanBarang: (idSuratJalan: string, items: any[], role: string, username: string) =>
    callApiFunction('simpanPenerimaanBarang', idSuratJalan, items, role, username),

  getDaftarSuratJalanUntukTujuan: (cabangTujuan: string) =>
    callApiFunction('getDaftarSuratJalanUntukTujuan', cabangTujuan),

  terimaBarangTujuan: (idSuratJalan: string, items: any[], role: string, username: string, cabangUser: string) =>
    callApiFunction('terimaBarangTujuan', idSuratJalan, items, role, username, cabangUser),

  terimaBarangEksternal: (idSuratJalan: string, items: any[], username: string, externalSource: string) =>
    callApiFunction('terimaBarangEksternal', idSuratJalan, items, username, externalSource),

  simpanPenerimaanEksternal: (payload: any) =>
    callApiFunction('simpanPenerimaanEksternal', payload),

  getDaftarPenerimaanEksternal: () =>
    callApiFunction('getDaftarPenerimaanEksternal'),

  hapusPenerimaanEksternal: (id: string) =>
    callApiFunction('hapusPenerimaanEksternal', id),

  getPenerimaanEksternalDetail: (id: string) =>
    callApiFunction('getPenerimaanEksternalDetail', id),

  updatePenerimaanEksternal: (id: string, payload: any) =>
    callApiFunction('updatePenerimaanEksternal', id, payload),

  cetakPenerimaanEksternal: (id: string) =>
    callApiFunction('cetakPenerimaanEksternal', id),

  getDaftarKirimanPending: (role: string, cabang: string) =>
    callApiFunction('getDaftarKirimanPending', role, cabang),

  getOpenPenerimaanEksternalUntukTujuan: (tujuanSite: string) =>
    callApiFunction('getOpenPenerimaanEksternalUntukTujuan', tujuanSite),
};