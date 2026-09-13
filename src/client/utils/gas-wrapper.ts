/**
 * GasAPI wrapper — fetch-based client for Vercel backend.
 * Keeps the same GasAPI interface & callGasFunction signature
 * so all existing components & services work without changes.
 */

export function callGasFunction(functionName: string, ...args: any[]): Promise<any> {
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

export const GasAPI = {
  login: (username: string, password: string) =>
    callGasFunction('login', username, password),

  logout: () =>
    callGasFunction('logout'),

  gantiPassword: (payload: any) =>
    callGasFunction('gantiPassword', payload),

  getDaftarSuratJalan: (role: string, cabang: string) =>
    callGasFunction('getDaftarSuratJalan', role, cabang),

  getDetailSuratJalan: (id: string) =>
    callGasFunction('getDetailSuratJalan', id),

  getSuratJalanForEdit: (id: string, role: string, cabang: string) =>
    callGasFunction('getSuratJalanForEdit', id, role, cabang),

  getCabangList: () =>
    callGasFunction('getCabangList'),

  getJenisBarangList: () =>
    callGasFunction('getJenisBarangList'),

  getAlamatList: () =>
    callGasFunction('getAlamatList'),

  simpanSuratJalan: (payload: any) =>
    callGasFunction('simpanSuratJalan', payload),

  updateSuratJalan: (id: string, payload: any) =>
    callGasFunction('updateSuratJalan', id, payload),

  hapusSuratJalan: (id: string) =>
    callGasFunction('hapusSuratJalan', id),

  deleteSuratJalan: (id: string, role: string, cabang: string) =>
    callGasFunction('deleteSuratJalan', id, role, cabang),

  updateStatusFisikDetail: (idDetail: string, status: string, role: string, username: string) =>
    callGasFunction('updateStatusFisikDetail', idDetail, status, role, username),

  batalTerima: (id: string, role: string, username: string) =>
    callGasFunction('batalTerima', id, role, username),

  batalkanPenerimaan: (id: string, role: string, username: string) =>
    callGasFunction('batalkanPenerimaan', id, role, username),

  updatePengirimanLanjutan: (id: string, payload: any) =>
    callGasFunction('updatePengirimanLanjutan', id, payload),

  buatPdfSuratJalan: (id: string, nama: string) =>
    callGasFunction('buatPdfSuratJalan', id, nama),

  bukaModalLanjutan: (id: string) =>
    callGasFunction('bukaModalLanjutan', id),

  getAlamatFullList: () =>
    callGasFunction('getAlamatFullList'),

  simpanAlamat: (payload: any) =>
    callGasFunction('simpanAlamat', payload),

  hapusAlamat: (site: string) =>
    callGasFunction('hapusAlamat', site),

  simpanPenerimaanBarang: (idSuratJalan: string, items: any[], role: string, username: string) =>
    callGasFunction('simpanPenerimaanBarang', idSuratJalan, items, role, username),

  getDaftarSuratJalanUntukTujuan: (cabangTujuan: string) =>
    callGasFunction('getDaftarSuratJalanUntukTujuan', cabangTujuan),

  terimaBarangTujuan: (idSuratJalan: string, items: any[], role: string, username: string, cabangUser: string) =>
    callGasFunction('terimaBarangTujuan', idSuratJalan, items, role, username, cabangUser),

  terimaBarangEksternal: (idSuratJalan: string, items: any[], username: string, externalSource: string) =>
    callGasFunction('terimaBarangEksternal', idSuratJalan, items, username, externalSource),

  simpanPenerimaanEksternal: (payload: any) =>
    callGasFunction('simpanPenerimaanEksternal', payload),

  getDaftarPenerimaanEksternal: () =>
    callGasFunction('getDaftarPenerimaanEksternal'),

  hapusPenerimaanEksternal: (id: string) =>
    callGasFunction('hapusPenerimaanEksternal', id),

  getPenerimaanEksternalDetail: (id: string) =>
    callGasFunction('getPenerimaanEksternalDetail', id),

  updatePenerimaanEksternal: (id: string, payload: any) =>
    callGasFunction('updatePenerimaanEksternal', id, payload),

  cetakPenerimaanEksternal: (id: string) =>
    callGasFunction('cetakPenerimaanEksternal', id),

  getDaftarKirimanPending: (role: string, cabang: string) =>
    callGasFunction('getDaftarKirimanPending', role, cabang),

  getOpenPenerimaanEksternalUntukTujuan: (tujuanSite: string) =>
    callGasFunction('getOpenPenerimaanEksternalUntukTujuan', tujuanSite),
};