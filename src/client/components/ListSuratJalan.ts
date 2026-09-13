import { DataService } from '../services/data';
import { AuthService } from '../services/auth';
import { showMessage } from '../utils/messaging';
import { GasAPI } from '../utils/gas-wrapper';
import { paginate, uniqueValues, normalizeDate, getFilterValue, renderPagination, UKURAN_HALAMAN } from '../utils/pagination';
import type { SuratJalanHeader } from '../types';

// ============================================================
// STATE
// ============================================================

let DAFTAR_CACHE: any[] = [];
const DETAIL_CACHE: Record<string, any[]> = {};
const ROW_DATA_BY_ID: Record<string, any> = {};
let HALAMAN_SEKARANG = 1;

// ============================================================
// RENDER
// ============================================================

export function renderListSuratJalan(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectListSuratJalan';
  section.style.display = 'none';
  section.className = 'space-y-4';

  section.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
        <h2 class="text-lg font-bold text-slate-900"><i class="bi bi-folder2-open"></i> Daftar Surat Jalan</h2>
      </div>
      <button id="btnGoCreate" class="sj-btn-primary">
        <i class="bi bi-plus-circle"></i>
        <span>Buat Surat Jalan Baru</span>
      </button>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col md:flex-row gap-3 mb-3">
        <select id="filterTipe" class="sj-select flex-1">
          <option value="">Semua Tipe</option>
          <option value="reguler">Surat Jalan Biasa</option>
          <option value="eksternal">Penerimaan Eksternal</option>
        </select>

        <select id="filterStatus" class="sj-select flex-1">
          <option value="">Semua Status</option>
          <option value="Dikirim">Dikirim</option>
          <option value="Diterima Sebagian">Diterima Sebagian</option>
          <option value="Diterima Cikupa">Diterima Cikupa</option>
        </select>

        <input 
          type="text" 
          id="filterCari" 
          class="sj-input flex-1"
          placeholder="Cari semua data surat jalan (no. SJ, no. bukti, barang, dst.)..."
        />

        <button id="btnRefreshList" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
          <i class="bi bi-arrow-clockwise"></i> Muat Ulang
        </button>
      </div>

      <div class="flex flex-col md:flex-row gap-3 pb-3 border-b border-slate-100">
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Tanggal</label>
          <input type="date" id="filterTanggal" class="sj-input w-full" />
        </div>
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Asal</label>
          <select id="filterAsal" class="sj-select w-full"><option value="">Semua Asal</option></select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Tujuan</label>
          <select id="filterTujuan" class="sj-select w-full"><option value="">Semua Tujuan</option></select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Tujuan Akhir</label>
          <select id="filterTujuanAkhir" class="sj-select w-full"><option value="">Semua Tujuan Akhir</option></select>
        </div>
      </div>

      <div id="tabelWrap" class="overflow-x-auto"></div>
      <div id="paginationWrap" class="mt-2"></div>
    </div>

    <!-- Modal Pengiriman Lanjutan -->
    <div id="modalLanjutanWrap" class="fixed inset-0 z-50 items-center justify-center bg-black/50" style="display:none;">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="p-5 border-b border-slate-200">
          <h6 class="font-bold text-slate-900"><i class="bi bi-truck me-1"></i> Atur Pengiriman Lanjutan &mdash; <span id="lanjutanNoSurat" class="text-blue-600 font-mono"></span></h6>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-slate-500">Tujuan Akhir: <strong id="lanjutanTujuanAkhir" class="text-blue-600"></strong></p>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Tanggal Kirim Lanjutan</label>
            <input type="date" id="lTanggalKirim" class="sj-input" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">No Truk</label>
            <input type="text" id="lNoTruk" class="sj-input" placeholder="cth: K 9343 RK" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Sopir</label>
            <input type="text" id="lSopir" class="sj-input" placeholder="cth: Agus" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Status Kirim Pusat</label>
            <select id="lStatus" class="sj-select">
              <option value="Menunggu Truk">Menunggu Truk</option>
              <option value="Dikirim">Dikirim</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
        </div>
        <div class="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button id="btnCancelLanjutan" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium"><i class="bi bi-x-circle"></i>Batal</button>
          <button id="btnSubmitLanjutan" class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm"><i class="bi bi-check2-circle"></i>Simpan</button>
        </div>
      </div>
    </div>

    <!-- Modal View Detail (Read-only) -->
    <div id="modalViewWrap" class="fixed inset-0 z-50 items-center justify-center bg-black/50" style="display:none;">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h6 class="font-bold text-slate-900"><i class="bi bi-eye me-1"></i> Detail Surat Jalan</h6>
            <p class="text-xs text-slate-500 mt-0.5">No. SJ: <span id="viewNoSurat" class="font-mono text-blue-600"></span></p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnEditView" class="sj-btn-icon sj-btn-edit" title="Edit Surat Jalan" style="display:none;"><i class="bi bi-pencil"></i></button>
            <button id="btnCloseView" class="text-slate-400 hover:text-slate-600 text-xl"><i class="bi bi-x-lg"></i></button>
          </div>
        </div>
        <div id="viewContent" class="px-6 py-4 overflow-y-auto flex-grow"></div>
        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div class="flex gap-2">
            <button id="btnCetakView" class="sj-btn-primary">
              <i class="bi bi-printer"></i>
              <span>Cetak</span>
            </button>
            <button id="btnUnduhView" class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <i class="bi bi-download"></i>
              <span>Unduh PDF</span>
            </button>
          </div>
          <button id="btnCloseViewFooter" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium">
            <i class="bi bi-x-circle"></i> Tutup
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Penerimaan Barang (Checklist) -->
    <div id="modalPenerimaanWrap" class="fixed inset-0 z-50 items-center justify-center bg-black/50" style="display:none;">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h6 class="font-bold text-slate-900"><i class="bi bi-clipboard-check me-1"></i> Penerimaan Barang</h6>
            <p class="text-xs text-slate-500 mt-0.5">No. SJ: <span id="penerimaanNoSurat" class="font-mono text-blue-600"></span></p>
          </div>
          <button id="btnClosePenerimaan" class="text-slate-400 hover:text-slate-600 text-xl"><i class="bi bi-x-lg"></i></button>
        </div>
        <div id="penerimaanContent" class="px-6 py-4 overflow-y-auto flex-grow"></div>
        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" id="penerimaanCheckAll" class="checkbox checkbox-sm checkbox-primary" />
            <span>Pilih Semua</span>
          </label>
          <div class="flex gap-2">
            <button id="btnCancelPenerimaan" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium">
              <i class="bi bi-x-circle"></i> Batal
            </button>
            <button id="btnSimpanPenerimaan" class="sj-btn-primary">
              <i class="bi bi-check2-circle"></i>
              <span>Simpan Penerimaan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupListEvents(section);
  return section;
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupListEvents(section: HTMLElement) {
  const filterTipe = section.querySelector('#filterTipe') as HTMLSelectElement;
  const filterStatus = section.querySelector('#filterStatus') as HTMLSelectElement;
  const filterCari = section.querySelector('#filterCari') as HTMLInputElement;
  const filterTanggal = section.querySelector('#filterTanggal') as HTMLInputElement;
  const filterAsal = section.querySelector('#filterAsal') as HTMLSelectElement;
  const filterTujuan = section.querySelector('#filterTujuan') as HTMLSelectElement;
  const filterTujuanAkhir = section.querySelector('#filterTujuanAkhir') as HTMLSelectElement;
  const refreshBtn = section.querySelector('#btnRefreshList') as HTMLButtonElement;
  const goCreateBtn = section.querySelector('#btnGoCreate') as HTMLButtonElement;
  const tabelWrap = section.querySelector('#tabelWrap') as HTMLElement;

  const triggerRender = () => { HALAMAN_SEKARANG = 1; renderTabel(); };
  filterTipe.addEventListener('change', triggerRender);
  filterStatus.addEventListener('change', triggerRender);
  filterCari.addEventListener('input', triggerRender);
  filterTanggal.addEventListener('change', triggerRender);
  filterAsal.addEventListener('change', triggerRender);
  filterTujuan.addEventListener('change', triggerRender);
  filterTujuanAkhir.addEventListener('change', triggerRender);
  refreshBtn.addEventListener('click', () => muatDaftar(tabelWrap));
  goCreateBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('view-create-triggered'));
  });

  // Modal Lanjutan
  const btnCancelLanjutan = section.querySelector('#btnCancelLanjutan') as HTMLButtonElement;
  const btnSubmitLanjutan = section.querySelector('#btnSubmitLanjutan') as HTMLButtonElement;
  const modalWrap = section.querySelector('#modalLanjutanWrap') as HTMLElement;

  btnCancelLanjutan.addEventListener('click', () => modalWrap.style.display = 'none');
  btnSubmitLanjutan.addEventListener('click', () => submitPengirimanLanjutan(tabelWrap));

  // Close modal on backdrop click
  modalWrap.addEventListener('click', (e) => {
    if (e.target === modalWrap) modalWrap.style.display = 'none';
  });

  // Modal View Detail
  const viewWrap = section.querySelector('#modalViewWrap') as HTMLElement;
  const btnCloseView = section.querySelector('#btnCloseView') as HTMLButtonElement;
  const btnCloseViewFooter = section.querySelector('#btnCloseViewFooter') as HTMLButtonElement;
  const btnCetakView = section.querySelector('#btnCetakView') as HTMLButtonElement;
  const btnUnduhView = section.querySelector('#btnUnduhView') as HTMLButtonElement;
  const btnEditView = section.querySelector('#btnEditView') as HTMLButtonElement;
  const closeView = () => { viewWrap.style.display = 'none'; };
  btnCloseView.addEventListener('click', closeView);
  btnCloseViewFooter.addEventListener('click', closeView);
  viewWrap.addEventListener('click', (e) => { if (e.target === viewWrap) closeView(); });
  btnEditView.addEventListener('click', () => {
    const noSj = section.querySelector('#viewNoSurat')?.textContent;
    const row = noSj ? Object.values(ROW_DATA_BY_ID).find((r: any) => r.noSuratJalan === noSj) : null;
    if (row) {
      closeView();
      (window as any)._sj.mulaiEdit(row.id);
    }
  });
  btnCetakView.addEventListener('click', () => {
    const noSj = section.querySelector('#viewNoSurat')?.textContent;
    const row = noSj ? Object.values(ROW_DATA_BY_ID).find((r: any) => r.noSuratJalan === noSj) : null;
    if (row) cetakPrint(row.id);
  });
  btnUnduhView.addEventListener('click', () => {
    const noSj = section.querySelector('#viewNoSurat')?.textContent;
    const row = noSj ? Object.values(ROW_DATA_BY_ID).find((r: any) => r.noSuratJalan === noSj) : null;
    if (row) cetakPdf(row.id);
  });

  // Modal Penerimaan
  const penerimaanWrap = section.querySelector('#modalPenerimaanWrap') as HTMLElement;
  const btnClosePenerimaan = section.querySelector('#btnClosePenerimaan') as HTMLButtonElement;
  const btnCancelPenerimaan = section.querySelector('#btnCancelPenerimaan') as HTMLButtonElement;
  const btnSimpanPenerimaan = section.querySelector('#btnSimpanPenerimaan') as HTMLButtonElement;
  const checkAll = section.querySelector('#penerimaanCheckAll') as HTMLInputElement;

  const closePenerimaan = () => { penerimaanWrap.style.display = 'none'; PENERIMAAN_ID = null; };
  btnClosePenerimaan.addEventListener('click', closePenerimaan);
  btnCancelPenerimaan.addEventListener('click', closePenerimaan);
  penerimaanWrap.addEventListener('click', (e) => { if (e.target === penerimaanWrap) closePenerimaan(); });

  checkAll.addEventListener('change', () => {
    const checkboxes = penerimaanWrap.querySelectorAll('.penerimaan-check') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => { cb.checked = checkAll.checked; });
  });

  btnSimpanPenerimaan.addEventListener('click', () => submitPenerimaan(tabelWrap));

  // Listen to view-list event
  window.addEventListener('view-list', () => {
    const user = AuthService.getCurrentUser();
    if (user) {
      muatDaftar(tabelWrap);
    } else {
      tabelWrap.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">Silakan login terlebih dahulu</div>';
    }
  });

  // Listen to refresh events
  window.addEventListener('refresh-list', () => {
    muatDaftar(tabelWrap);
  });
}

// ============================================================
// LOAD & RENDER
// ============================================================

async function muatDaftar(wrapEl: HTMLElement) {
  wrapEl.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
  const user = AuthService.getCurrentUser();
  if (!user) return;

  try {
    const list = await DataService.loadDaftarSuratJalan();
    DAFTAR_CACHE = list;
    Object.keys(DETAIL_CACHE).forEach((k) => delete DETAIL_CACHE[k]);
    Object.keys(ROW_DATA_BY_ID).forEach((k) => delete ROW_DATA_BY_ID[k]);
    list.forEach((r: any) => { ROW_DATA_BY_ID[r.id] = r; });
    isiFilterDropdown();
    HALAMAN_SEKARANG = 1;
    renderTabel();
  } catch (err: any) {
    wrapEl.innerHTML = '<div class="text-center py-8 text-red-500"><i class="bi bi-exclamation-triangle text-xl"></i> Gagal memuat data.</div>';
    showMessage({ type: 'error', text: 'Gagal memuat data: ' + (err.message || err) });
  }
}

function isiFilterDropdown() {
  const asalSel = document.getElementById('filterAsal') as HTMLSelectElement | null;
  const tujuanSel = document.getElementById('filterTujuan') as HTMLSelectElement | null;
  const tujuanAkhirSel = document.getElementById('filterTujuanAkhir') as HTMLSelectElement | null;
  if (!asalSel || !tujuanSel || !tujuanAkhirSel) return;

  const asalNow = asalSel.value;
  const tujuanNow = tujuanSel.value;
  const tujuanAkhirNow = tujuanAkhirSel.value;

  const isi = (sel: HTMLSelectElement, values: string[], placeholder: string, current: string) => {
    const selected = current && values.includes(current) ? current : '';
    sel.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
  };

  isi(asalSel, uniqueValues(DAFTAR_CACHE, (r: any) => r.cabangAsal), 'Semua Asal', asalNow);
  isi(tujuanSel, uniqueValues(DAFTAR_CACHE, (r: any) => r.cabangTujuan), 'Semua Tujuan', tujuanNow);
  isi(tujuanAkhirSel, uniqueValues(DAFTAR_CACHE, (r: any) => r.tujuanAkhir), 'Semua Tujuan Akhir', tujuanAkhirNow);
}

function renderTabel() {
  const tipe = getFilterValue('filterTipe');
  const status = getFilterValue('filterStatus');
  const tanggal = getFilterValue('filterTanggal');
  const asal = getFilterValue('filterAsal');
  const tujuan = getFilterValue('filterTujuan');
  const tujuanAkhir = getFilterValue('filterTujuanAkhir');
  const cari = getFilterValue('filterCari').toLowerCase();
  const wrap = document.getElementById('tabelWrap');
  const paginationWrap = document.getElementById('paginationWrap');
  if (!wrap) return;

  let data = DAFTAR_CACHE;

  // Filter by tipe: reguler (no EXT- prefix) or eksternal (EXT- prefix)
  if (tipe === 'reguler') {
    data = data.filter((r: any) => !(r.noSuratJalan || '').startsWith('EXT-'));
  } else if (tipe === 'eksternal') {
    data = data.filter((r: any) => (r.noSuratJalan || '').startsWith('EXT-'));
  }

  if (status) data = data.filter((r: any) => r.status === status);
  if (tanggal) data = data.filter((r: any) => normalizeDate(r.tanggal) === tanggal);
  if (asal) data = data.filter((r: any) => (r.cabangAsal || '') === asal);
  if (tujuan) data = data.filter((r: any) => (r.cabangTujuan || '') === tujuan);
  if (tujuanAkhir) data = data.filter((r: any) => (r.tujuanAkhir || '') === tujuanAkhir);
  if (cari) {
    data = data.filter((r: any) => {
      const headerMatch = [
        r.noSuratJalan, r.tanggal, r.cabangAsal, r.cabangTujuan, r.kodeJenis,
        r.dikirimVia, r.status, r.dibuatOleh, r.diupdateOleh, r.perluDiteruskan,
        r.tujuanAkhir, r.noTruk, r.sopir, r.statusKirimPusat
      ].some(val => val && String(val).toLowerCase().includes(cari));

      const itemMatch = Array.isArray(r.items) && r.items.some((item: any) => [
        item.noBukti, item.deskripsi, item.satuan, item.keterangan, item.qty
      ].some(val => val !== undefined && val !== null && String(val).toLowerCase().includes(cari)));

      return headerMatch || itemMatch;
    });
  }

  if (data.length === 0) {
    const adaFilter = tipe || status || tanggal || asal || tujuan || tujuanAkhir || cari;
    wrap.innerHTML = adaFilter
      ? `<div class="text-center py-8 text-slate-400"><i class="bi bi-search text-2xl mb-2 block"></i>Tidak ada data yang cocok dengan filter yang dipilih.</div>`
      : '<div class="text-center py-8 text-slate-400"><i class="bi bi-inbox text-2xl mb-2 block"></i>Belum ada data surat jalan.</div>';
    if (paginationWrap) paginationWrap.innerHTML = '';
    return;
  }

  const paged = paginate(data, HALAMAN_SEKARANG, UKURAN_HALAMAN);
  data = paged.items;

  const user = AuthService.getCurrentUser();
  let html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold whitespace-nowrap">';
  html += '<th class="p-2" style="width:90px;">Aksi</th>';
  html += '<th class="p-2 text-left">No. Surat Jalan</th>';
  html += '<th class="p-2 text-left">Tanggal</th>';
  html += '<th class="p-2 text-left">Asal</th>';
  html += '<th class="p-2 text-left">Tujuan</th>';
  html += '<th class="p-2 text-center">Qty</th>';
  html += '<th class="p-2 text-left">Status</th>';
  html += '<th class="p-2 text-left">Tujuan Akhir</th>';
  html += '<th class="p-2 text-left">Status Kirim</th>';
  html += '<th class="p-2 text-left">No Truk</th>';
  html += '<th class="p-2 text-left">Sopir</th>';
  html += '<th class="p-2 text-left">Diterima Oleh</th>';
  html += '<th class="p-2 text-left">Waktu Diterima</th>';
  html += '<th class="p-2 text-left">Diupdate Oleh</th>';
  html += '<th class="p-2 text-left">Waktu Update</th>';
  html += '<th class="p-2 text-left">Dibuat Oleh</th>';
  html += '</tr></thead><tbody>';

  data.forEach((r: any) => {
    // Handle new statuses for non-transit items
    const isNonTransit = r.perluDiteruskan !== 'Ya';
    let badgeClass = 'bg-blue-100 text-blue-800'; // default: Dikirim / Menunggu Penerimaan
    if (r.status === 'Diterima Cikupa' || r.status === 'Diterima Tujuan') {
      badgeClass = 'bg-green-100 text-green-800';
    } else if (r.status === 'Diterima Sebagian') {
      badgeClass = 'bg-yellow-100 text-yellow-800';
    } else if (isNonTransit && r.status === 'Menunggu Penerimaan') {
      badgeClass = 'bg-slate-100 text-slate-800';
    }

    const bisaUbah = !(r.status === 'Diterima Cikupa' || r.status === 'Diterima Tujuan');

    const isLanjutan = r.perluDiteruskan === 'Ya';
    const badgeLanjutan = r.statusKirimPusat === 'Selesai' ? 'bg-green-100 text-green-800' :
      (r.statusKirimPusat === 'Dikirim' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800');
    const tujuanAkhirText = isLanjutan && r.tujuanAkhir ? r.tujuanAkhir : '<span class="text-slate-300">-</span>';
    const statusKirimText = isLanjutan ? `<span class="inline-block text-xs px-1.5 py-0.5 rounded-full ${badgeLanjutan}">${r.statusKirimPusat || 'Menunggu Truk'}</span>` : '<span class="text-slate-300">-</span>';
    const noTrukText = isLanjutan && r.noTruk ? r.noTruk : '<span class="text-slate-300">-</span>';
    const sopirText = isLanjutan && r.sopir ? r.sopir : '<span class="text-slate-300">-</span>';

    // Action buttons
    let aksi = `<button class="sj-btn-icon sj-btn-view" title="Lihat Detail" onclick="window._sj.toggleDetail('${r.id}')"><i class="bi bi-eye"></i></button>`;
    
    // Admin receive button: for transit items not yet fully received at Cikupa, for non-transit items not yet fully received at destination
    const canAdminReceive = user?.role === 'admin' && (
      (isNonTransit && r.status !== 'Diterima Tujuan') || 
      (!isNonTransit && r.status !== 'Diterima Cikupa')
    );
    if (canAdminReceive) {
      aksi += `<button class="sj-btn-icon sj-btn-confirm" title="Terima Barang" onclick="window._sj.bukaPenerimaan('${r.id}')"><i class="bi bi-clipboard-check"></i></button>`;
    }
    
    if (bisaUbah) {
      aksi += `<button class="sj-btn-icon sj-btn-edit" title="Edit" onclick="window._sj.mulaiEdit('${r.id}')"><i class="bi bi-pencil"></i></button>`;
      aksi += `<button class="sj-btn-icon sj-btn-delete" title="Hapus" onclick="window._sj.hapusSuratJalan('${r.id}','${r.noSuratJalan}')"><i class="bi bi-trash"></i></button>`;
    }
    
    // Admin revert button: for items that have been partially/fully received
    const canAdminRevert = user?.role === 'admin' && (
      (isNonTransit && (r.status === 'Diterima Sebagian' || r.status === 'Diterima Tujuan')) ||
      (!isNonTransit && (r.status === 'Diterima Sebagian' || r.status === 'Diterima Cikupa'))
    );
    if (canAdminRevert) {
      aksi += `<button class="sj-btn-icon sj-btn-revert" title="Batal Terima" onclick="window._sj.batalTerima('${r.id}','${r.noSuratJalan}')"><i class="bi bi-arrow-counterclockwise"></i></button>`;
    }
    
    if (user?.role === 'admin' && r.perluDiteruskan === 'Ya') {
      aksi += `<button class="sj-btn-icon sj-btn-truck" title="Atur Lanjutan" onclick="window._sj.bukaModalLanjutan('${r.id}')"><i class="bi bi-truck"></i></button>`;
    }

    const isEksternal = (r.noSuratJalan || '').startsWith('EXT-');
    const badgeEksternal = isEksternal ? '<span class="inline-block text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 ml-1 font-semibold">EKSTERNAL</span>' : '';

    html += `<tr class="border-b border-slate-100 hover:bg-slate-50/50 whitespace-nowrap">`;
    html += `<td class="p-2 text-sm">${aksi}</td>`;
    html += `<td class="p-2 font-mono text-sm">${r.noSuratJalan}${badgeEksternal}</td>`;
    html += `<td class="p-2 text-sm">${r.tanggal}</td>`;
    html += `<td class="p-2 text-sm">${r.cabangAsal}</td>`;
    html += `<td class="p-2 text-sm">${r.cabangTujuan}</td>`;
    html += `<td class="p-2 text-center text-sm">${r.totalBarang}</td>`;
    html += `<td class="p-2"><span class="inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClass}">${r.status}</span></td>`;
    html += `<td class="p-2 text-sm">${tujuanAkhirText}</td>`;
    html += `<td class="p-2 text-sm">${statusKirimText}</td>`;
    html += `<td class="p-2 text-sm font-mono text-xs">${noTrukText}</td>`;
    html += `<td class="p-2 text-sm">${sopirText}</td>`;
    
    // Compute reception info from detail data
    const details = DETAIL_CACHE[r.id] || [];
    const receivedItems = details.filter((d: any) => d.statusFisik === 'Diterima');
    let diterimaOlehText = '<span class="text-slate-300">-</span>';
    let waktuDiterimaText = '<span class="text-slate-300">-</span>';
    
    if (receivedItems.length > 0) {
      // Get unique receivers and latest time
      const receivers = [...new Set(receivedItems.map((d: any) => d.diterimaOleh).filter(Boolean))];
      diterimaOlehText = receivers.join(', ') || '<span class="text-slate-300">-</span>';
      
      // Get latest reception time
      const times = receivedItems.map((d: any) => d.waktuDiterima).filter(Boolean);
      if (times.length > 0) {
        waktuDiterimaText = times.sort().reverse()[0]; // Latest time
      }
    }
    
    html += `<td class="p-2 text-sm text-slate-600">${diterimaOlehText}</td>`;
    html += `<td class="p-2 text-sm text-slate-600 font-mono text-xs">${waktuDiterimaText}</td>`;
    
    // Last updated info
    const diupdateOlehText = r.diupdateOleh ? `<span class="text-slate-600">${r.diupdateOleh}</span>` : '<span class="text-slate-300">-</span>';
    const waktuUpdateText = r.waktuUpdate ? `<span class="text-slate-600 font-mono text-xs">${r.waktuUpdate}</span>` : '<span class="text-slate-300">-</span>';
    
    html += `<td class="p-2 text-sm">${diupdateOlehText}</td>`;
    html += `<td class="p-2 text-sm">${waktuUpdateText}</td>`;
    
    html += `<td class="p-2 text-sm text-slate-500">${r.dibuatOleh}</td>`;
    html += `</tr>`;
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;

  if (paginationWrap) {
    renderPagination(paginationWrap, paged, (page) => {
      HALAMAN_SEKARANG = page;
      renderTabel();
    });
  }
}

// ============================================================
// MODAL VIEW DETAIL (READ-ONLY)
// ============================================================

async function toggleDetail(idSuratJalan: string) {
  const data = ROW_DATA_BY_ID[idSuratJalan];
  const section = document.getElementById('sectListSuratJalan')!;
  const modalWrap = section.querySelector('#modalViewWrap') as HTMLElement;
  const content = section.querySelector('#viewContent') as HTMLElement;
  const noSuratEl = section.querySelector('#viewNoSurat') as HTMLElement;

  noSuratEl.textContent = data.noSuratJalan;
  content.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';

  // Show/hide Edit button based on permission
  const user = AuthService.getCurrentUser();
  const isNonTransit = data.perluDiteruskan !== 'Ya';
  const bisaUbah = (data.status === 'Dikirim' || data.status === 'Menunggu Penerimaan') && (user?.role === 'admin' || data.cabangAsal === user?.cabang);
  const btnEditView = section.querySelector('#btnEditView') as HTMLButtonElement;
  if (btnEditView) btnEditView.style.display = bisaUbah ? '' : 'none';

  modalWrap.style.display = 'flex';

  try {
    const [details, alamatList] = await Promise.all([
      DataService.getDetailSuratJalan(idSuratJalan),
      GasAPI.getAlamatFullList(),
    ]);
    DETAIL_CACHE[idSuratJalan] = details;

    // Lookup alamat tujuan: coba tujuanAkhir dulu (bisa berisi nama perusahaan atau site code),
    // kalau tidak cocok, fallback ke cabangTujuan (site code seperti 'MLG', 'SLY', dll)
    let alamatTujuan = data.tujuanAkhir ? alamatList.find((a: any) => a.site === data.tujuanAkhir) : null;
    if (!alamatTujuan && data.cabangTujuan) {
      alamatTujuan = alamatList.find((a: any) => a.site === data.cabangTujuan);
    }
    const alamatAsal = data.cabangAsal ? alamatList.find((a: any) => a.site === data.cabangAsal) : null;
    const picMengetahui = alamatAsal?.pic || '-';

    // Kepada Yth block
    let kepadaHtml: string;
    if (alamatTujuan) {
      const pic = alamatTujuan.pic || '-';
      kepadaHtml = `<div class="text-sm leading-relaxed">` +
        `<div>Kepada Yth.</div>` +
        `<div class="font-bold">${pic}</div>` +
        `<div>${alamatTujuan.dept || ''}</div>` +
        `<div>${alamatTujuan.alamat || ''}</div>` +
        `<div>${alamatTujuan.kelurahan || ''}</div>` +
        `<div>${alamatTujuan.kecamatan || ''}</div>` +
        `<div>${alamatTujuan.kota || ''}</div>` +
        `<div>${alamatTujuan.tlp || ''}</div>` +
        `</div>`;
    } else {
      kepadaHtml = `<div class="text-sm">Kepada Yth.<br><strong>${data.cabangTujuan}</strong></div>`;
    }

    // Tabel barang
    let totalQty = 0;
    let barisTabel = '';
    details.forEach((d: any, idx: number) => {
      const qtyNum = Number(d.qty) || 0;
      totalQty += qtyNum;
      const sudahDiterima = d.statusFisik === 'Diterima';
      const badgeFisik = sudahDiterima ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
      barisTabel += `<tr class="border-b border-slate-100">`;
      barisTabel += `<td class="p-2 text-center text-sm">${idx + 1}</td>`;
      barisTabel += `<td class="p-2 text-sm font-mono text-slate-600 whitespace-nowrap">${d.noBukti || '-'}</td>`;
      barisTabel += `<td class="p-2 text-sm">${d.deskripsi}</td>`;
      barisTabel += `<td class="p-2 text-center text-sm">${d.qty}</td>`;
      barisTabel += `<td class="p-2 text-center text-sm">${d.satuan || '-'}</td>`;
      barisTabel += `<td class="p-2 text-sm text-slate-500">${d.keterangan || '-'}</td>`;
      barisTabel += `<td class="p-2 text-center text-sm">`;
      barisTabel += `<span class="inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${badgeFisik}">${d.statusFisik}</span>`;
      if (sudahDiterima && d.diterimaOleh) {
        barisTabel += `<div class="text-xs text-slate-500 mt-1">${d.diterimaOleh} &middot; ${d.waktuDiterima}</div>`;
      }
      barisTabel += `</td></tr>`;
    });

    // Nama cabang asal
    const namaCabangAsal = alamatAsal?.site || data.cabangAsal;

    // Build PDF-like HTML
    let h = '';

    // Company Header
    h += `<div class="flex items-start justify-between mb-4 pb-3 border-b border-slate-200">`;
    h += `<div>`;
    h += `<div class="text-base font-bold text-slate-900 leading-tight">PT. SARANA KENCANA MULYA</div>`;
    h += `<div class="text-sm font-semibold text-slate-700">${namaCabangAsal}</div>`;
    h += `</div>`;
    h += `<div class="text-center">`;
    h += `<div class="text-lg font-black text-slate-900 tracking-wide">POLYTRON</div>`;
    h += `<img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(data.noSuratJalan)}" alt="QR" class="w-14 h-14 mx-auto mt-1" />`;
    h += `</div>`;
    h += `</div>`;

    // Pengirim name (used in Dari block + signatures)
    const pengirim = alamatAsal?.pengirim || data.dibuatOleh || '-';

    // Dari (Pengirim) block — PIC, DEPT, TLP saja
    let dariHtml: string;
    if (alamatAsal) {
      dariHtml = `<div class="text-sm leading-relaxed mt-3 pt-3 border-t border-slate-200">` +
        `<div class="font-semibold text-slate-700">Dari:</div>` +
        `<div class="font-bold">${pengirim}</div>` +
        `<div>${alamatAsal.dept || ''}</div>` +
        `<div>Telp: ${alamatAsal.tlp || '-'}</div>` +
        `</div>`;
    } else {
      dariHtml = `<div class="text-sm mt-3 pt-3 border-t border-slate-200"><span class="font-semibold">Dari:</span> <strong>${pengirim}</strong></div>`;
    }

    // Two-column details
    h += `<div class="flex gap-6 mb-4">`;
    // Left: Kepada Yth + Dari (pengirim)
    h += `<div class="flex-1">${kepadaHtml}${dariHtml}</div>`;
    // Right: Nomor Bukti, Tanggal, etc.
    h += `<div class="flex-shrink-0 w-auto">`;
    h += `<table class="text-sm">`;
    h += `<tr><td class="py-0.5 pr-2 text-slate-500 whitespace-nowrap">Nomor Bukti</td><td class="py-0.5 font-semibold whitespace-nowrap">: ${data.noSuratJalan}</td></tr>`;
    h += `<tr><td class="py-0.5 pr-2 text-slate-500 whitespace-nowrap">Tanggal Bukti</td><td class="py-0.5 font-semibold whitespace-nowrap">: ${data.tanggal}</td></tr>`;
    h += `<tr><td class="py-0.5 pr-2 text-slate-500 whitespace-nowrap">Asal</td><td class="py-0.5 font-semibold whitespace-nowrap">: ${data.cabangAsal}</td></tr>`;
    h += `<tr><td class="py-0.5 pr-2 text-slate-500 whitespace-nowrap">Tujuan</td><td class="py-0.5 font-semibold whitespace-nowrap">: ${data.cabangTujuan}</td></tr>`;
    h += `</table>`;
    h += `</div></div>`;

    // Remarks
    h += `<div class="mb-4 text-sm"><span class="font-semibold">Remarks:</span> <span class="text-slate-600">${data.dikirimVia || '-'}</span></div>`;

    // Data Table
    h += `<div class="border border-slate-200 rounded-lg overflow-hidden mb-4">`;
    h += `<table class="w-full text-sm">`;
    h += `<thead><tr class="bg-slate-50 border-b border-slate-200">`;
    h += `<th class="p-2 w-12 text-center font-semibold text-slate-700">No</th>`;
    h += `<th class="p-2 text-left font-semibold text-slate-700">Part</th>`;
    h += `<th class="p-2 text-left font-semibold text-slate-700">Deskripsi</th>`;
    h += `<th class="p-2 w-16 text-center font-semibold text-slate-700">Qty</th>`;
    h += `<th class="p-2 w-16 text-center font-semibold text-slate-700">UM</th>`;
    h += `<th class="p-2 text-left font-semibold text-slate-700">Keterangan</th>`;
    h += `<th class="p-2 w-28 text-center font-semibold text-slate-700">Status</th>`;
    h += `</tr></thead><tbody>`;
    h += barisTabel;
    // Total row
    h += `<tr class="bg-slate-50 font-bold">`;
    h += `<td colspan="3" class="p-2 text-right text-sm">Total</td>`;
    h += `<td class="p-2 text-center text-sm">${totalQty}</td>`;
    h += `<td colspan="3"></td>`;
    h += `</tr>`;
    h += `</tbody></table></div>`;

    // Signatures
    const namaSopir = data.sopir || '';
    const noTruk = data.noTruk || '';
    const namaPenerima = alamatTujuan?.pic || '';

    h += `<div class="grid grid-cols-4 gap-4 mt-6 pt-4">`;
    // Pengirim
    h += `<div class="text-center">`;
    h += `<div class="text-xs font-bold uppercase mb-8">Pengirim</div>`;
    h += `<div class="text-sm font-bold mb-1">${pengirim}</div>`;
    h += `<div class="text-xs text-slate-500 italic mb-2">ADM SPAREPART</div>`;
    h += `<div class="border-b border-slate-900 w-3/4 mx-auto"></div>`;
    h += `</div>`;
    // Mengetahui
    h += `<div class="text-center">`;
    h += `<div class="text-xs font-bold uppercase mb-8">Mengetahui</div>`;
    h += `<div class="text-sm font-bold mb-1">${picMengetahui}</div>`;
    h += `<div class="text-xs text-slate-500 italic mb-2">HoDS</div>`;
    h += `<div class="border-b border-slate-900 w-3/4 mx-auto"></div>`;
    h += `</div>`;
    // Sopir/Ekspedisi
    h += `<div class="text-center">`;
    h += `<div class="text-xs font-bold uppercase mb-8">Sopir/Ekspedisi</div>`;
    h += `<div class="text-sm font-bold mb-1">${namaSopir}</div>`;
    h += `<div class="text-xs text-slate-500 italic mb-2">${noTruk}</div>`;
    h += `<div class="border-b border-slate-900 w-3/4 mx-auto"></div>`;
    h += `</div>`;
    // Penerima
    h += `<div class="text-center">`;
    h += `<div class="text-xs font-bold uppercase mb-8">Penerima</div>`;
    h += `<div class="text-sm font-bold mb-1">${namaPenerima}</div>`;
    h += `<div class="text-xs text-slate-500 italic mb-2">&nbsp;</div>`;
    h += `<div class="border-b border-slate-900 w-3/4 mx-auto"></div>`;
    h += `</div>`;
    h += `</div>`;

    content.innerHTML = h;
  } catch (err: any) {
    content.innerHTML = `<div class="text-center py-8 text-red-500"><i class="bi bi-exclamation-triangle text-xl"></i> Gagal memuat detail: ${err.message}</div>`;
  }
}

// ============================================================
// MODAL PENERIMAAN BARANG (CHECKLIST)
// ============================================================

let PENERIMAAN_ID: string | null = null;

async function bukaPenerimaan(idSuratJalan: string) {
  PENERIMAAN_ID = idSuratJalan;
  const data = ROW_DATA_BY_ID[idSuratJalan];
  const section = document.getElementById('sectListSuratJalan')!;
  const modalWrap = section.querySelector('#modalPenerimaanWrap') as HTMLElement;
  const content = section.querySelector('#penerimaanContent') as HTMLElement;
  const noSuratEl = section.querySelector('#penerimaanNoSurat') as HTMLElement;
  const checkAll = section.querySelector('#penerimaanCheckAll') as HTMLInputElement;

  noSuratEl.textContent = data.noSuratJalan;
  checkAll.checked = false;
  content.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
  modalWrap.style.display = 'flex';

  try {
    const details = await DataService.getDetailSuratJalan(idSuratJalan);
    DETAIL_CACHE[idSuratJalan] = details;

    if (details.length === 0) {
      content.innerHTML = '<div class="text-center py-8 text-slate-400 italic">Tidak ada detail barang.</div>';
      return;
    }

    let t = '<table class="w-full text-sm"><thead><tr class="bg-slate-50 border-b border-slate-200">';
    t += '<th class="p-2 w-10 text-center">#</th>';
    t += '<th class="p-2 text-left font-semibold text-slate-700">No Bukti</th>';
    t += '<th class="p-2 text-left font-semibold text-slate-700">Deskripsi</th>';
    t += '<th class="p-2 text-center font-semibold text-slate-700">Qty</th>';
    t += '<th class="p-2 text-left font-semibold text-slate-700">Satuan</th>';
    t += '<th class="p-2 text-left font-semibold text-slate-700">Keterangan</th>';
    t += '<th class="p-2 text-left font-semibold text-slate-700">Status</th>';
    t += '</tr></thead><tbody>';

    details.forEach((d: any) => {
      const sudahDiterima = d.statusFisik === 'Diterima';
      const badgeFisik = sudahDiterima ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500';

      t += '<tr class="border-b border-slate-100 hover:bg-slate-50/50">';
      t += `<td class="p-2 text-center"><input type="checkbox" class="penerimaan-check checkbox checkbox-sm checkbox-primary" data-id="${d.idDetail}" ${sudahDiterima ? 'checked' : ''} /></td>`;
      t += `<td class="p-2 text-slate-500 font-mono text-xs">${d.noBukti || '-'}</td>`;
      t += `<td class="p-2">${d.deskripsi}</td>`;
      t += `<td class="p-2 text-center">${d.qty}</td>`;
      t += `<td class="p-2">${d.satuan || '-'}</td>`;
      t += `<td class="p-2 text-slate-500">${d.keterangan || '-'}</td>`;
      t += `<td class="p-2"><span class="inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${badgeFisik}">${d.statusFisik}</span>`;
      if (sudahDiterima && d.diterimaOleh) {
        t += `<div class="text-xs text-slate-500 mt-1">${d.diterimaOleh} &middot; ${d.waktuDiterima}</div>`;
      }
      t += '</td>';
      t += '</tr>';
    });

    t += '</tbody></table>';
    content.innerHTML = t;

    // Update checkAll state whenever a checkbox changes
    const checkboxes = content.querySelectorAll('.penerimaan-check') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        checkAll.checked = allChecked;
      });
    });
  } catch (err: any) {
    content.innerHTML = `<div class="text-center py-8 text-red-500"><i class="bi bi-exclamation-triangle text-xl"></i> Gagal memuat detail: ${err.message}</div>`;
  }
}

async function submitPenerimaan(wrapEl: HTMLElement) {
  if (!PENERIMAAN_ID) return;
  const section = document.getElementById('sectListSuratJalan')!;
  const user = AuthService.getCurrentUser();
  const content = section.querySelector('#penerimaanContent') as HTMLElement;
  const checkboxes = content.querySelectorAll('.penerimaan-check') as NodeListOf<HTMLInputElement>;

  if (checkboxes.length === 0) {
    showMessage({ type: 'error', text: 'Tidak ada item untuk disimpan.' });
    return;
  }

  const items = Array.from(checkboxes).map(cb => ({
    idDetail: cb.dataset.id,
    diterima: cb.checked,
  }));

  const btnSimpan = section.querySelector('#btnSimpanPenerimaan') as HTMLButtonElement;
  btnSimpan.disabled = true;
  btnSimpan.innerHTML = '<i class="bi bi-hourglass-split"></i> Menyimpan...';

  try {
    await DataService.simpanPenerimaanBarang(PENERIMAAN_ID, items, user?.role || '', user?.username || '');
    showMessage({ type: 'success', text: 'Penerimaan barang berhasil disimpan.' });
    (section.querySelector('#modalPenerimaanWrap') as HTMLElement).style.display = 'none';
    PENERIMAAN_ID = null;
    await muatDaftar(wrapEl);
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal menyimpan penerimaan: ' + err.message });
  } finally {
    btnSimpan.disabled = false;
    btnSimpan.innerHTML = '<i class="bi bi-check2-circle"></i><span>Simpan Penerimaan</span>';
  }
}

// ============================================================
// ACTIONS
// ============================================================

function cetakPdf(idSuratJalan: string) {
  const user = AuthService.getCurrentUser();
  showMessage({ type: 'success', text: 'Membuat PDF, mohon tunggu...' });

  GasAPI.buatPdfSuratJalan(idSuratJalan, user?.nama || '').then((res: any) => {
    if (!res.success) {
      showMessage({ type: 'error', text: res.message });
      return;
    }
    try {
      const byteChars = atob(res.base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showMessage({ type: 'success', text: 'PDF berhasil diunduh.' });
    } catch (e: any) {
      showMessage({ type: 'error', text: 'Gagal memproses PDF: ' + e.message });
    }
  }).catch((err: any) => {
    showMessage({ type: 'error', text: 'Gagal membuat PDF: ' + err.message });
  });
}

function cetakPrint(idSuratJalan: string) {
  const user = AuthService.getCurrentUser();
  showMessage({ type: 'success', text: 'Menyiapkan cetak, mohon tunggu...' });

  GasAPI.buatPdfSuratJalan(idSuratJalan, user?.nama || '').then((res: any) => {
    if (!res.success) {
      showMessage({ type: 'error', text: res.message });
      return;
    }
    try {
      const byteChars = atob(res.base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Use iframe for printing (avoids popup blockers)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // Fallback: open in new tab
          const w = window.open(url, '_blank');
          if (w) {
            w.onload = () => w.print();
          } else {
            showMessage({ type: 'error', text: 'Popup diblokir. Izinkan popup untuk mencetak.' });
          }
        }
        setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 5000);
      };
    } catch (e: any) {
      showMessage({ type: 'error', text: 'Gagal memproses PDF: ' + e.message });
    }
  }).catch((err: any) => {
    showMessage({ type: 'error', text: 'Gagal membuat PDF: ' + err.message });
  });
}

async function batalTerima(idSuratJalan: string, noSuratJalan: string) {
  if (!confirm('Batalkan status penerimaan untuk surat jalan ' + noSuratJalan + '?\n\nSemua item barang akan direset ke "Belum Diterima".')) return;
  const user = AuthService.getCurrentUser();
  try {
    await DataService.batalkanPenerimaan(idSuratJalan, user?.role || '', user?.username || '');
    showMessage({ type: 'success', text: 'Status penerimaan berhasil dibatalkan.' });
    delete DETAIL_CACHE[idSuratJalan];
    await muatDaftar(document.getElementById('tabelWrap') as HTMLElement);
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal membatalkan: ' + err.message });
  }
}

async function hapusSuratJalan(id: string, noSuratJalan: string) {
  if (!confirm('Hapus surat jalan ' + noSuratJalan + ' beserta semua detail barangnya?\nTindakan ini tidak bisa dibatalkan.')) return;
  const user = AuthService.getCurrentUser();
  try {
    await DataService.deleteSuratJalan(id, user?.role || '', user?.cabang || '');
    showMessage({ type: 'success', text: 'Surat jalan berhasil dihapus.' });
    await muatDaftar(document.getElementById('tabelWrap') as HTMLElement);
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal menghapus: ' + err.message });
  }
}

function mulaiEdit(id: string) {
  window.dispatchEvent(new CustomEvent('edit-surat', { detail: { id } }));
}

// ============================================================
// MODAL LANJUTAN
// ============================================================

let LANJUTAN_ID: string | null = null;

function bukaModalLanjutan(id: string) {
  LANJUTAN_ID = id;
  const data = ROW_DATA_BY_ID[id];
  const section = document.getElementById('sectListSuratJalan')!;
  const modalWrap = section.querySelector('#modalLanjutanWrap') as HTMLElement;

  (section.querySelector('#lanjutanNoSurat') as HTMLElement).textContent = data.noSuratJalan;
  (section.querySelector('#lanjutanTujuanAkhir') as HTMLElement).textContent = data.tujuanAkhir;
  (section.querySelector('#lTanggalKirim') as HTMLInputElement).value = data.tanggalKirimLanjutan ? data.tanggalKirimLanjutan.split('/').reverse().join('-') : '';
  (section.querySelector('#lNoTruk') as HTMLInputElement).value = data.noTruk || '';
  (section.querySelector('#lSopir') as HTMLInputElement).value = data.sopir || '';
  (section.querySelector('#lStatus') as HTMLSelectElement).value = data.statusKirimPusat || 'Menunggu Truk';

  modalWrap.style.display = 'flex';
}

async function submitPengirimanLanjutan(wrapEl: HTMLElement) {
  if (!LANJUTAN_ID) return;
  const section = document.getElementById('sectListSuratJalan')!;
  const user = AuthService.getCurrentUser();

  const payload = {
    tanggalKirimLanjutan: (section.querySelector('#lTanggalKirim') as HTMLInputElement).value,
    noTruk: (section.querySelector('#lNoTruk') as HTMLInputElement).value.trim(),
    sopir: (section.querySelector('#lSopir') as HTMLInputElement).value.trim(),
    statusKirimPusat: (section.querySelector('#lStatus') as HTMLSelectElement).value,
    role: user?.role,
    username: user?.username,
  };

  try {
    await DataService.updatePengirimanLanjutan(LANJUTAN_ID, payload);
    showMessage({ type: 'success', text: 'Data pengiriman lanjutan berhasil disimpan.' });
    (section.querySelector('#modalLanjutanWrap') as HTMLElement).style.display = 'none';
    await muatDaftar(wrapEl);
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal menyimpan: ' + err.message });
  }
}

// ============================================================
// EXPOSE TO WINDOW (for onclick handlers in HTML)
// ============================================================

(window as any)._sj = {
  toggleDetail,
  bukaPenerimaan,
  mulaiEdit,
  hapusSuratJalan,
  batalTerima,
  cetakPdf,
  cetakPrint,
  bukaModalLanjutan,
};
