import { DataService } from '../services/data';
import { AuthService } from '../services/auth';
import { showMessage } from '../utils/messaging';
import { paginate, normalizeDate, getFilterValue, renderPagination, UKURAN_HALAMAN } from '../utils/pagination';

let extRowCount = 0;
let currentViewId = '';
let currentExtListData: any[] = [];
let HALAMAN_SEKARANG = 1;

// ============================================================
// RENDER
// ============================================================

export function renderPenerimaanEksternal(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectPenerimaanEksternal';
  section.style.display = 'none';
  section.className = 'space-y-4';

  section.innerHTML = `
    <!-- LIST VIEW -->
    <div id="peListWrap" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
          <h2 class="text-lg font-bold text-slate-900"><i class="bi bi-inbox me-1"></i> Penerimaan Eksternal</h2>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" id="peSearchInput" class="sj-input pl-9 pr-8 py-2 text-sm w-64" placeholder="Cari semua data..." />
            <button id="peSearchClear" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" style="display:none;"><i class="bi bi-x-circle"></i></button>
          </div>
          <div>
            <input type="date" id="peFilterTanggal" class="sj-input py-2 text-sm w-44" />
          </div>
          <select id="peFilterSumber" class="sj-select py-2 text-sm w-40">
            <option value="">Semua Sumber</option>
            <option value="KUDUS">RMS KUDUS</option>
            <option value="SAYUNG">RMS SAYUNG</option>
          </select>
          <button id="btnGoCreateExt" class="sj-btn-primary pe-admin-only">
            <i class="bi bi-plus-circle"></i>
            <span>Tambah Penerimaan</span>
          </button>
        </div>
      </div>
      <div id="peDaftarWrap" class="overflow-x-auto"></div>
      <div id="pePaginationWrap" class="mt-2"></div>
    </div>

    <!-- FORM VIEW -->
    <div id="peFormWrap" class="bg-white border border-slate-200 rounded-2xl shadow-sm" style="display:none;">
      <div class="p-6 border-b border-slate-100">
        <div class="flex items-center justify-between mb-1">
          <h2 id="peFormTitle" class="text-lg font-bold text-slate-900"><i class="bi bi-box-arrow-in-down me-1"></i> Tambah Penerimaan Eksternal</h2>
          <button type="button" id="peBtnBackForm" class="sj-btn-back"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
        </div>
        <p class="text-sm text-slate-500 mt-1">Input data penerimaan barang dari sumber eksternal.</p>
      </div>
      <form id="formPenerimaanEksternal" class="p-6 space-y-6">
        <input type="hidden" id="peEditId" value="" />
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Sumber <span class="text-red-500">*</span></label>
              <select id="peSumber" class="sj-select">
                <option value="">-- Pilih Sumber --</option>
                <option value="KUDUS">RMS KUDUS</option>
                <option value="SAYUNG">RMS SAYUNG</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Tanggal</label>
              <input type="date" id="peTanggal" class="sj-input" />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">No. Surat Jalan <span class="text-red-500">*</span></label>
              <input type="text" id="peNoSurat" class="sj-input" placeholder="cth: RMS-KUDUS/001/VII/26" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">No. Truk</label>
              <input type="text" id="peNoTruk" class="sj-input" placeholder="cth: K 9343 RK" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Kurir / Sopir</label>
              <input type="text" id="peKurir" class="sj-input" placeholder="cth: Bp. Sujarwo" />
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-900">Detail Barang / Spare Part</h3>
          <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200">
                  <th class="p-3 text-center font-semibold text-slate-700 w-10">No</th>
                  <th class="p-3 text-left font-semibold text-slate-700">No Bukti</th>
                  <th class="p-3 text-left font-semibold text-slate-700">Deskripsi</th>
                  <th class="p-3 text-center font-semibold text-slate-700 w-20">Qty</th>
                  <th class="p-3 text-left font-semibold text-slate-700 w-20">Satuan</th>
                  <th class="p-3 text-left font-semibold text-slate-700 w-28">Tujuan</th>
                  <th class="p-3 text-left font-semibold text-slate-700">Keterangan</th>
                  <th class="p-3 text-center font-semibold text-slate-700 w-10"></th>
                </tr>
              </thead>
              <tbody id="detailRowsEksternal"></tbody>
            </table>
          </div>
          <button type="button" id="btnAddRowEksternal" class="sj-btn-view inline-flex items-center gap-1 px-4 py-2 font-medium rounded-lg text-sm transition-colors">
            <i class="bi bi-plus-circle"></i>Tambah Baris
          </button>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" id="btnCancelEksternal" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 font-medium rounded-lg text-sm transition-colors">
            <i class="bi bi-x-circle"></i>Batal
          </button>
          <button type="submit" class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm">
            <i class="bi bi-check2-circle"></i>Simpan
          </button>
        </div>
      </form>
    </div>

    <!-- MODAL VIEW DETAIL -->
    <div id="peModalViewWrap" class="fixed inset-0 z-50 items-center justify-center bg-black/50" style="display:none;">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h6 class="font-bold text-slate-900"><i class="bi bi-inbox me-1"></i> Detail Penerimaan Eksternal</h6>
          <button id="peBtnCloseView" class="sj-btn-icon"><i class="bi bi-x-lg"></i></button>
        </div>
        <div id="peModalViewBody" class="flex-1 overflow-y-auto p-6"></div>
        <div class="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button id="peBtnCetakView" class="sj-btn-view inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium"><i class="bi bi-printer"></i>Cetak</button>
          <button id="peBtnEditView" class="sj-btn-edit inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium pe-admin-only"><i class="bi bi-pencil"></i>Edit</button>
        </div>
      </div>
    </div>
  `;

  setupEksternalEvents(section);
  return section;
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupEksternalEvents(section: HTMLElement) {
  const createBtn = section.querySelector('#btnGoCreateExt') as HTMLButtonElement;
  const form = section.querySelector('#formPenerimaanEksternal') as HTMLFormElement;
  const addRowBtn = section.querySelector('#btnAddRowEksternal') as HTMLButtonElement;
  const cancelBtn = section.querySelector('#btnCancelEksternal') as HTMLButtonElement;
  const searchInput = section.querySelector('#peSearchInput') as HTMLInputElement;
  const searchClear = section.querySelector('#peSearchClear') as HTMLButtonElement;

  createBtn.addEventListener('click', (e) => { e.preventDefault(); showForm(section); });
  addRowBtn.addEventListener('click', (e) => { e.preventDefault(); tambahBarisEksternal(section); });
  cancelBtn.addEventListener('click', (e) => { e.preventDefault(); showList(section); });
  const backFormBtn = section.querySelector('#peBtnBackForm') as HTMLButtonElement;
  if (backFormBtn) backFormBtn.addEventListener('click', () => showList(section));
  form.addEventListener('submit', async (e) => { e.preventDefault(); await submitPenerimaanEksternal(section); });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    searchClear.style.display = term ? '' : 'none';
    HALAMAN_SEKARANG = 1;
    renderFilteredExtList(section, term);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    HALAMAN_SEKARANG = 1;
    renderFilteredExtList(section, '');
  });

  const filterTanggalPe = section.querySelector('#peFilterTanggal') as HTMLInputElement;
  const filterSumber = section.querySelector('#peFilterSumber') as HTMLSelectElement;
  filterTanggalPe.addEventListener('change', () => { HALAMAN_SEKARANG = 1; renderFilteredExtList(section, searchInput.value.trim().toLowerCase()); });
  filterSumber.addEventListener('change', () => { HALAMAN_SEKARANG = 1; renderFilteredExtList(section, searchInput.value.trim().toLowerCase()); });

  const closeViewBtn = section.querySelector('#peBtnCloseView') as HTMLButtonElement;
  const cetakViewBtn = section.querySelector('#peBtnCetakView') as HTMLButtonElement;
  const editViewBtn = section.querySelector('#peBtnEditView') as HTMLButtonElement;
  const modalWrap = section.querySelector('#peModalViewWrap') as HTMLElement;

  closeViewBtn.addEventListener('click', () => { modalWrap.style.display = 'none'; });
  modalWrap.addEventListener('click', (e) => { if (e.target === modalWrap) modalWrap.style.display = 'none'; });
  cetakViewBtn.addEventListener('click', () => { if (currentViewId) cetakPenerimaanEksternal(currentViewId); });
  editViewBtn.addEventListener('click', () => {
    modalWrap.style.display = 'none';
    if (currentViewId) loadEditForm(section, currentViewId);
  });

  applyRoleVisibility(section);

  window.addEventListener('view-penerimaan-eksternal', () => {
    applyRoleVisibility(section);
    searchInput.value = '';
    searchClear.style.display = 'none';
    (section.querySelector('#peFilterTanggal') as HTMLInputElement).value = '';
    (section.querySelector('#peFilterSumber') as HTMLSelectElement).value = '';
    HALAMAN_SEKARANG = 1;
    muatDaftarTujuan();
    showList(section);
    loadDaftarPenerimaanEksternal(section);
  });
}

function applyRoleVisibility(section: HTMLElement) {
  const user = AuthService.getCurrentUser();
  const isAdmin = user?.role === 'admin';
  section.querySelectorAll('.pe-admin-only').forEach((el) => {
    (el as HTMLElement).style.display = isAdmin ? '' : 'none';
  });
}

// ============================================================
// VIEW TOGGLE
// ============================================================

function showList(section: HTMLElement) {
  (section.querySelector('#peListWrap') as HTMLElement).style.display = '';
  (section.querySelector('#peFormWrap') as HTMLElement).style.display = 'none';
  loadDaftarPenerimaanEksternal(section);
}

function showForm(section: HTMLElement) {
  (section.querySelector('#peListWrap') as HTMLElement).style.display = 'none';
  (section.querySelector('#peFormWrap') as HTMLElement).style.display = '';
  (section.querySelector('#peEditId') as HTMLInputElement).value = '';
  (section.querySelector('#peFormTitle') as HTMLElement).innerHTML = '<i class="bi bi-box-arrow-in-down me-1"></i> Tambah Penerimaan Eksternal';
  resetFormEksternal(section);
}

// ============================================================
// LOAD DAFTAR (TABLE LIKE SURAT JALAN)
// ============================================================

async function loadDaftarPenerimaanEksternal(section: HTMLElement) {
  const wrap = section.querySelector('#peDaftarWrap') as HTMLElement;
  wrap.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';

  try {
    const list = await DataService.loadDaftarPenerimaanEksternal();
    currentExtListData = list || [];
    HALAMAN_SEKARANG = 1;
    
    const searchInput = section.querySelector('#peSearchInput') as HTMLInputElement;
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
    renderFilteredExtList(section, term);
  } catch (err: any) {
    wrap.innerHTML = '<div class="text-center py-8 text-red-500"><i class="bi bi-exclamation-triangle text-xl"></i> Gagal memuat data.</div>';
    showMessage({ type: 'error', text: 'Gagal memuat data: ' + (err.message || err) });
  }
}

function renderFilteredExtList(section: HTMLElement, searchTerm: string) {
  const wrap = section.querySelector('#peDaftarWrap') as HTMLElement;
  const paginationWrap = section.querySelector('#pePaginationWrap') as HTMLElement;
  
  if (!currentExtListData || currentExtListData.length === 0) {
    wrap.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="bi bi-inbox text-2xl mb-2 block"></i>Belum ada data penerimaan eksternal.</div>';
    if (paginationWrap) paginationWrap.innerHTML = '';
    return;
  }

  const filterTanggal = getFilterValue('peFilterTanggal');
  const filterSumber = getFilterValue('peFilterSumber');

  let filteredList = currentExtListData;
  filteredList = filteredList.filter((r: any) => {
    if (filterTanggal && normalizeDate(r.tanggal) !== filterTanggal) return false;
    if (filterSumber && (r.rms || '') !== filterSumber) return false;
    return true;
  });
  if (searchTerm) {
    filteredList = filteredList.filter((r: any) => {
      const rmsLabel = r.rms === 'KUDUS' ? 'RMS KUDUS' : r.rms === 'SAYUNG' ? 'RMS SAYUNG' : (r.rms || '');
      const headerMatch = [
        r.noSuratJalan, r.tanggal, r.rms, rmsLabel, r.noTruk, r.kurir, r.diterimaOleh, r.waktuInput
      ].some(val => val && String(val).toLowerCase().includes(searchTerm));
      const itemMatch = Array.isArray(r.items) && r.items.some((item: any) => [
        item.noBukti, item.deskripsi, item.satuan, item.keterangan
      ].some(val => val && String(val).toLowerCase().includes(searchTerm)));
      return headerMatch || itemMatch;
    });
  }

  if (filteredList.length === 0) {
    wrap.innerHTML = `<div class="text-center py-8 text-slate-400"><i class="bi bi-search text-2xl mb-2 block"></i>Tidak ada data yang cocok dengan pencarian/filter.</div>`;
    if (paginationWrap) paginationWrap.innerHTML = '';
    return;
  }

  const paged = paginate(filteredList, HALAMAN_SEKARANG, UKURAN_HALAMAN);
  filteredList = paged.items;

  let html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold whitespace-nowrap">';
  html += '<th class="p-2" style="width:100px;">Aksi</th>';
  html += '<th class="p-2 text-left">No. Surat Jalan</th>';
  html += '<th class="p-2 text-left">Tanggal</th>';
  html += '<th class="p-2 text-left">Sumber</th>';
  html += '<th class="p-2 text-center">Qty</th>';
  html += '<th class="p-2 text-left">No Truk</th>';
  html += '<th class="p-2 text-left">Kurir / Sopir</th>';
  html += '<th class="p-2 text-left">Diterima Oleh</th>';
  html += '<th class="p-2 text-left">Waktu Input</th>';
  html += '</tr></thead><tbody>';

  filteredList.forEach((r: any) => {
    const totalQty = r.items ? r.items.reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0) : 0;

    const user = AuthService.getCurrentUser();
    const isAdmin = user?.role === 'admin';

    html += '<tr class="border-b border-slate-100 hover:bg-slate-50/50 whitespace-nowrap">';
    html += '<td class="p-2">';
    html += `<button class="sj-btn-icon sj-btn-view" title="Lihat Detail" onclick="window._pe.viewDetail('${r.id}')"><i class="bi bi-eye"></i></button>`;
    if (isAdmin) {
      html += `<button class="sj-btn-icon sj-btn-edit" title="Edit" onclick="window._pe.edit('${r.id}')"><i class="bi bi-pencil"></i></button>`;
      html += `<button class="sj-btn-icon sj-btn-view" title="Cetak PDF" onclick="window._pe.cetak('${r.id}')"><i class="bi bi-printer"></i></button>`;
      html += `<button class="sj-btn-icon sj-btn-delete" title="Hapus" onclick="window._pe.hapus('${r.id}','${r.noSuratJalan}')"><i class="bi bi-trash"></i></button>`;
    }
    html += '</td>';
    html += `<td class="p-2 font-mono text-sm">${r.noSuratJalan}</td>`;
    html += `<td class="p-2 text-sm">${r.tanggal}</td>`;
    html += `<td class="p-2"><span class="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">${r.rms}</span></td>`;
    html += `<td class="p-2 text-center text-sm">${totalQty}</td>`;
    html += `<td class="p-2 text-sm font-mono text-xs">${r.noTruk || '<span class="text-slate-300">-</span>'}</td>`;
    html += `<td class="p-2 text-sm">${r.kurir || '<span class="text-slate-300">-</span>'}</td>`;
    html += `<td class="p-2 text-sm">${r.diterimaOleh}</td>`;
    html += `<td class="p-2 text-sm">${r.waktuInput}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;

  if (paginationWrap) {
    renderPagination(paginationWrap, paged, (page) => {
      HALAMAN_SEKARANG = page;
      renderFilteredExtList(section, searchTerm);
    });
  }
}

// ============================================================
// VIEW DETAIL MODAL
// ============================================================

async function viewDetailPenerimaanEksternal(id: string) {
  currentViewId = id;
  const modalWrap = document.getElementById('peModalViewWrap') as HTMLElement;
  const body = document.getElementById('peModalViewBody') as HTMLElement;
  body.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
  modalWrap.style.display = 'flex';

  try {
    const result = await DataService.getPenerimaanEksternalDetail(id);
    if (!result.success || !result.header) {
      body.innerHTML = '<div class="text-center py-8 text-red-500">Data tidak ditemukan.</div>';
      return;
    }
    const h = result.header;
    const items = result.items || [];

    let html = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 text-sm">
        <div><span class="font-semibold text-slate-600">No. Surat Jalan:</span><div class="font-mono font-bold text-slate-900">${h.noSuratJalan}</div></div>
        <div><span class="font-semibold text-slate-600">Sumber:</span><div><span class="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">${h.rms}</span></div></div>
        <div><span class="font-semibold text-slate-600">Tanggal:</span><div class="text-slate-900">${h.tanggal || '-'}</div></div>
        <div><span class="font-semibold text-slate-600">No. Truk:</span><div class="text-slate-900">${h.noTruk || '-'}</div></div>
        <div><span class="font-semibold text-slate-600">Kurir / Sopir:</span><div class="text-slate-900">${h.kurir || '-'}</div></div>
        <div><span class="font-semibold text-slate-600">Diterima Oleh:</span><div class="text-slate-900">${h.diterimaOleh || '-'}</div></div>
      </div>
      <div class="overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
              <th class="p-2 text-center w-10">No</th>
              <th class="p-2 text-left">No Bukti</th>
              <th class="p-2 text-left">Deskripsi</th>
              <th class="p-2 text-center w-16">Qty</th>
              <th class="p-2 text-left w-20">Satuan</th>
              <th class="p-2 text-left w-24">Tujuan</th>
              <th class="p-2 text-left">Keterangan</th>
              <th class="p-2 text-center">Status Kirim</th>
            </tr>
          </thead>
          <tbody>`;
    items.forEach((item: any) => {
      const badge = item.statusFisik === 'Diterima'
        ? '<span class="inline-block text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">Diterima</span>'
        : '<span class="inline-block text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-800">' + (item.statusFisik || '-') + '</span>';
      const statusKirim = item.statusKirim || 'Open';
      const statusKirimBadge = statusKirim === 'Close'
        ? '<span class="inline-block text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">Close</span>'
        : statusKirim === 'Pending'
          ? '<span class="inline-block text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">Pending</span>'
          : '<span class="inline-block text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">Open</span>';
      html += `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50">
              <td class="p-2 text-center">${item.no}</td>
              <td class="p-2 font-mono text-xs">${item.noBukti || '-'}</td>
              <td class="p-2">${item.deskripsi}</td>
              <td class="p-2 text-center font-semibold">${item.qty}</td>
              <td class="p-2">${item.satuan || '-'}</td>
              <td class="p-2 text-xs font-semibold text-slate-700">${item.tujuanSite || '-'}</td>
              <td class="p-2 text-slate-500">${item.keterangan || '-'}</td>
              <td class="p-2 text-center">${statusKirimBadge}</td>
            </tr>`;
    });
    html += '</tbody></table></div>';
    body.innerHTML = html;
  } catch (err: any) {
    body.innerHTML = '<div class="text-center py-8 text-red-500">Gagal memuat detail.</div>';
  }
}

// ============================================================
// CETAK PDF
// ============================================================

async function cetakPenerimaanEksternal(id: string) {
  try {
    const result = await DataService.cetakPenerimaanEksternal(id);
    if (!result.success || !result.base64) {
      showMessage({ type: 'error', text: result.message || 'Gagal membuat PDF.' });
      return;
    }
    const byteChars = atob(result.base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal membuat PDF: ' + (err.message || err) });
  }
}

// ============================================================
// EDIT FORM
// ============================================================

async function loadEditForm(section: HTMLElement, id: string) {
  try {
    const result = await DataService.getPenerimaanEksternalDetail(id);
    if (!result.success || !result.header) {
      showMessage({ type: 'error', text: 'Data tidak ditemukan.' });
      return;
    }
    const h = result.header;
    const items = result.items || [];

    showForm(section);
    (section.querySelector('#peFormTitle') as HTMLElement).innerHTML = '<i class="bi bi-pencil me-1"></i> Edit Penerimaan Eksternal';
    (section.querySelector('#peEditId') as HTMLInputElement).value = id;
    (section.querySelector('#peSumber') as HTMLSelectElement).value = h.rms || '';
    (section.querySelector('#peNoSurat') as HTMLInputElement).value = h.noSuratJalan || '';
    if (h.tanggal) (section.querySelector('#peTanggal') as HTMLInputElement).value = h.tanggal;
    (section.querySelector('#peNoTruk') as HTMLInputElement).value = h.noTruk || '';
    (section.querySelector('#peKurir') as HTMLInputElement).value = h.kurir || '';

    const tbody = section.querySelector('#detailRowsEksternal') as HTMLTableSectionElement;
    tbody.innerHTML = '';
    extRowCount = 0;
    items.forEach((item: any) => {
      tambahBarisEksternal(section);
      const lastRow = tbody.lastElementChild as HTMLTableRowElement;
      (lastRow.querySelector('.d-nobukti') as HTMLInputElement).value = item.noBukti || '';
      (lastRow.querySelector('.d-deskripsi') as HTMLInputElement).value = item.deskripsi || '';
      (lastRow.querySelector('.d-qty') as HTMLInputElement).value = String(item.qty || '');
      (lastRow.querySelector('.d-satuan') as HTMLSelectElement).value = item.satuan || '';
      (lastRow.querySelector('.d-tujuan') as HTMLSelectElement).value = item.tujuanSite || '';
      (lastRow.querySelector('.d-keterangan') as HTMLInputElement).value = item.keterangan || '';
    });
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal memuat data edit: ' + (err.message || err) });
  }
}

// ============================================================
// DETAIL ROWS
// ============================================================

function tambahBarisEksternal(section: HTMLElement) {
  extRowCount++;
  const rowId = `perow_${extRowCount}`;
  const tbody = section.querySelector('#detailRowsEksternal') as HTMLTableSectionElement;
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.className = 'border-b border-slate-200 hover:bg-slate-50';
  tr.innerHTML = `
    <td class="p-3 text-center font-semibold text-slate-500">${tbody.children.length + 1}</td>
    <td class="p-3"><input type="text" class="sj-input sj-input-sm d-nobukti" placeholder="cth: KAP/TGR/SV/26/04/001" /></td>
    <td class="p-3"><input type="text" class="sj-input sj-input-sm d-deskripsi" placeholder="cth: SPAREPART HA NON MKS" /></td>
    <td class="p-3 text-center"><input type="number" min="1" class="sj-input sj-input-sm d-qty" placeholder="1" /></td>
    <td class="p-3"><select class="sj-select sj-select-sm d-satuan"><option value="">--</option><option value="EA">EA</option><option value="COLLY">COLLY</option><option value="BOX">BOX</option><option value="SET">SET</option><option value="PCS">PCS</option><option value="KG">KG</option><option value="ROLL">ROLL</option><option value="PACK">PACK</option><option value="UNIT">UNIT</option></select></td>
    <td class="p-3"><select class="sj-select sj-select-sm d-tujuan"><option value="">-- Pilih Tujuan --</option>${opsiTujuanOptions()}</select></td>
    <td class="p-3"><input type="text" class="sj-input sj-input-sm d-keterangan" placeholder="opsional" /></td>
    <td class="p-3 text-center"><button type="button" class="sj-btn-icon sj-btn-delete text-xs" onclick="document.getElementById('${rowId}')?.remove()"><i class="bi bi-x-lg"></i></button></td>
  `;
  tbody.appendChild(tr);
}

let daftarAlamatTujuan: { site: string; wilayah?: string }[] = [];

async function muatDaftarTujuan() {
  if (daftarAlamatTujuan.length > 0) return;
  try {
    const list = await DataService.loadAlamatList();
    daftarAlamatTujuan = list || [];
  } catch (err) {
    daftarAlamatTujuan = [];
  }
}

function opsiTujuanOptions(): string {
  return daftarAlamatTujuan.map((a) => `<option value="${a.site}">${a.site}</option>`).join('');
}

// ============================================================
// RESET FORM
// ============================================================

function resetFormEksternal(section: HTMLElement) {
  const form = section.querySelector('#formPenerimaanEksternal') as HTMLFormElement;
  form.reset();
  const tbody = section.querySelector('#detailRowsEksternal') as HTMLTableSectionElement;
  tbody.innerHTML = '';
  extRowCount = 0;
  tambahBarisEksternal(section);
}

// ============================================================
// SUBMIT
// ============================================================

async function submitPenerimaanEksternal(section: HTMLElement) {
  const user = AuthService.getCurrentUser();
  if (!user) return;

  const editId = (section.querySelector('#peEditId') as HTMLInputElement).value;
  const sumber = (section.querySelector('#peSumber') as HTMLSelectElement).value;
  const noSurat = (section.querySelector('#peNoSurat') as HTMLInputElement).value.trim();
  const tanggal = (section.querySelector('#peTanggal') as HTMLInputElement).value;
  const noTruk = (section.querySelector('#peNoTruk') as HTMLInputElement).value.trim();
  const kurir = (section.querySelector('#peKurir') as HTMLInputElement).value.trim();

  if (!sumber) { showMessage({ type: 'error', text: 'Sumber wajib dipilih.' }); return; }
  if (!noSurat) { showMessage({ type: 'error', text: 'No. Surat Jalan wajib diisi.' }); return; }

  const details: any[] = [];
  let tujuanMissing = false;
  const rows = section.querySelectorAll('#detailRowsEksternal tr');
  rows.forEach((tr: Element) => {
    const row = tr as HTMLTableRowElement;
    const noBukti = (row.querySelector('.d-nobukti') as HTMLInputElement).value.trim();
    const deskripsi = (row.querySelector('.d-deskripsi') as HTMLInputElement).value.trim();
    const qty = (row.querySelector('.d-qty') as HTMLInputElement).value;
    const satuan = (row.querySelector('.d-satuan') as HTMLSelectElement).value.trim();
    const tujuanSite = (row.querySelector('.d-tujuan') as HTMLSelectElement).value;
    const keterangan = (row.querySelector('.d-keterangan') as HTMLInputElement).value.trim();
    if (deskripsi && qty) {
      if (!tujuanSite) { tujuanMissing = true; return; }
      details.push({ noBukti, deskripsi, qty: parseInt(qty), satuan, tujuanSite, keterangan });
    }
  });

  if (tujuanMissing) { showMessage({ type: 'error', text: 'Tujuan harus dipilih untuk setiap baris barang.' }); return; }
  if (details.length === 0) { showMessage({ type: 'error', text: 'Minimal 1 baris detail barang harus diisi.' }); return; }

  const form = section.querySelector('#formPenerimaanEksternal') as HTMLFormElement;
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Menyimpan...';

  try {
    let result;
    const payload = { sumber, noSurat, tanggal, noTruk, kurir, details, username: user.username, cabang: user.cabang };
    if (editId) {
      result = await DataService.updatePenerimaanEksternal(editId, payload);
    } else {
      result = await DataService.simpanPenerimaanEksternal(payload);
    }

    if (result.success) {
      showMessage({ type: 'success', text: editId ? 'Berhasil diupdate.' : 'Berhasil disimpan.' });
      showList(section);
    } else {
      showMessage({ type: 'error', text: result.message || 'Gagal menyimpan.' });
    }
  } catch (error: any) {
    showMessage({ type: 'error', text: error instanceof Error ? error.message : 'Gagal menyimpan.' });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

// ============================================================
// GLOBAL HANDLERS
// ============================================================

(window as any)._pe = {
  viewDetail: (id: string) => viewDetailPenerimaanEksternal(id),
  edit: (id: string) => {
    const section = document.getElementById('sectPenerimaanEksternal');
    if (section) loadEditForm(section, id);
  },
  cetak: (id: string) => cetakPenerimaanEksternal(id),
  hapus: async (id: string, noSurat: string) => {
    if (!confirm(`Hapus penerimaan "${noSurat}"?`)) return;
    try {
      const result = await DataService.hapusPenerimaanEksternal(id);
      if (result.success) {
        showMessage({ type: 'success', text: 'Berhasil dihapus.' });
        const section = document.getElementById('sectPenerimaanEksternal');
        if (section) showList(section);
      } else {
        showMessage({ type: 'error', text: result.message || 'Gagal menghapus.' });
      }
    } catch (err: any) {
      showMessage({ type: 'error', text: 'Gagal menghapus: ' + (err.message || err) });
    }
  },
};
