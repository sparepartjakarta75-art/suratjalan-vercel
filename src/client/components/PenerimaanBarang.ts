import { DataService } from '../services/data';
import { AuthService } from '../services/auth';
import { showMessage } from '../utils/messaging';
import { Api } from '../utils/api-client';
import { paginate, uniqueValues, normalizeDate, getFilterValue, renderPagination, UKURAN_HALAMAN } from '../utils/pagination';
import type { SuratJalanHeader, DetailBarang } from '../types';

// ============================================================
// STATE
// ============================================================

let DAFTAR_TUJUAN_CACHE: SuratJalanHeader[] = [];
let DETAIL_TUJUAN_CACHE: Record<string, DetailBarang[]> = {};
let PENERIMAAN_ID: string | null = null;
let HALAMAN_SEKARANG = 1;

// ============================================================
// RENDER
// ============================================================

export function renderPenerimaanBarang(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectPenerimaanBarang';
  section.style.display = 'none';
  section.className = 'space-y-4';

  section.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
        <h2 class="text-lg font-bold text-slate-900"><i class="bi bi-box-arrow-in-down me-1"></i> Penerimaan Barang</h2>
      </div>
      <button id="btnRefreshPenerimaan" class="sj-btn-view inline-flex items-center gap-1 px-4 py-2 font-medium rounded-lg text-sm transition-colors">
        <i class="bi bi-arrow-clockwise"></i> Muat Ulang
      </button>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col md:flex-row gap-3 mb-3">
        <input 
          type="text" 
          id="filterCariPenerimaan" 
          class="sj-input flex-1" 
          placeholder="Cari no. surat jalan..."
        />
      </div>

      <div class="flex flex-col md:flex-row gap-3 pb-3 border-b border-slate-100">
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Tanggal</label>
          <input type="date" id="filterTanggalPenerimaan" class="sj-input w-full" />
        </div>
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Asal</label>
          <select id="filterAsalPenerimaan" class="sj-select w-full"><option value="">Semua Asal</option></select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Tujuan</label>
          <select id="filterTujuanPenerimaan" class="sj-select w-full"><option value="">Semua Tujuan</option></select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Tujuan Akhir</label>
          <select id="filterTujuanAkhirPenerimaan" class="sj-select w-full"><option value="">Semua Tujuan Akhir</option></select>
        </div>
      </div>

      <div id="tabelPenerimaanWrap" class="overflow-x-auto"></div>
      <div id="paginationPenerimaanWrap" class="mt-2"></div>
    </div>

    <!-- Modal Penerimaan Barang (Checklist) -->
    <div id="modalPenerimaanTujuanWrap" class="fixed inset-0 z-50 items-center justify-center bg-black/50" style="display:none;">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h6 class="font-bold text-slate-900"><i class="bi bi-clipboard-check me-1"></i> Penerimaan Barang</h6>
            <p class="text-xs text-slate-500 mt-0.5">No. SJ: <span id="penerimaanTujuanNoSurat" class="font-mono text-blue-600"></span></p>
          </div>
          <button id="btnClosePenerimaanTujuan" class="text-slate-400 hover:text-slate-600 text-xl"><i class="bi bi-x-lg"></i></button>
        </div>
        <div id="penerimaanTujuanContent" class="px-6 py-4 overflow-y-auto flex-grow"></div>
        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" id="penerimaanTujuanCheckAll" class="checkbox checkbox-sm checkbox-primary" />
            <span>Pilih Semua</span>
          </label>
          <div class="flex gap-2">
            <button id="btnCancelPenerimaanTujuan" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium">
              <i class="bi bi-x-circle"></i> Batal
            </button>
            <button id="btnSimpanPenerimaanTujuan" class="sj-btn-primary">
              <i class="bi bi-check2-circle"></i>
              <span>Simpan Penerimaan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupPenerimaanEvents(section);
  return section;
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupPenerimaanEvents(section: HTMLElement) {
  const refreshBtn = section.querySelector('#btnRefreshPenerimaan') as HTMLButtonElement;
  const filterCari = section.querySelector('#filterCariPenerimaan') as HTMLInputElement;
  const tabelWrap = section.querySelector('#tabelPenerimaanWrap') as HTMLElement;

  const triggerRender = () => { HALAMAN_SEKARANG = 1; renderTabelPenerimaan(); };
  refreshBtn.addEventListener('click', () => muatDaftarPenerimaan(tabelWrap));
  filterCari.addEventListener('input', triggerRender);
  const filterTanggal = section.querySelector('#filterTanggalPenerimaan') as HTMLInputElement;
  const filterAsal = section.querySelector('#filterAsalPenerimaan') as HTMLSelectElement;
  const filterTujuan = section.querySelector('#filterTujuanPenerimaan') as HTMLSelectElement;
  const filterTujuanAkhir = section.querySelector('#filterTujuanAkhirPenerimaan') as HTMLSelectElement;
  filterTanggal.addEventListener('change', triggerRender);
  filterAsal.addEventListener('change', triggerRender);
  filterTujuan.addEventListener('change', triggerRender);
  filterTujuanAkhir.addEventListener('change', triggerRender);

  // Modal Penerimaan
  const penerimaanWrap = section.querySelector('#modalPenerimaanTujuanWrap') as HTMLElement;
  const btnClosePenerimaan = section.querySelector('#btnClosePenerimaanTujuan') as HTMLButtonElement;
  const btnCancelPenerimaan = section.querySelector('#btnCancelPenerimaanTujuan') as HTMLButtonElement;
  const btnSimpanPenerimaan = section.querySelector('#btnSimpanPenerimaanTujuan') as HTMLButtonElement;
  const checkAll = section.querySelector('#penerimaanTujuanCheckAll') as HTMLInputElement;

  const closePenerimaan = () => { penerimaanWrap.style.display = 'none'; PENERIMAAN_ID = null; };
  btnClosePenerimaan.addEventListener('click', closePenerimaan);
  btnCancelPenerimaan.addEventListener('click', closePenerimaan);
  penerimaanWrap.addEventListener('click', (e) => { if (e.target === penerimaanWrap) closePenerimaan(); });

  checkAll.addEventListener('change', () => {
    const checkboxes = penerimaanWrap.querySelectorAll('.penerimaan-tujuan-check') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => { cb.checked = checkAll.checked; });
  });

  btnSimpanPenerimaan.addEventListener('click', () => submitPenerimaanTujuan(tabelWrap));

  // Listen to view event
  window.addEventListener('view-penerimaan-triggered', () => {
    const user = AuthService.getCurrentUser();
    if (user) {
      muatDaftarPenerimaan(tabelWrap);
    } else {
      tabelWrap.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">Silakan login terlebih dahulu</div>';
    }
  });
}

// ============================================================
// LOAD & RENDER
// ============================================================

async function muatDaftarPenerimaan(wrapEl: HTMLElement) {
  wrapEl.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
  const user = AuthService.getCurrentUser();
  if (!user) return;

  try {
    const list = await DataService.loadDaftarSuratJalanUntukTujuan(user.cabang);
    DAFTAR_TUJUAN_CACHE = list;
    Object.keys(DETAIL_TUJUAN_CACHE).forEach(k => delete DETAIL_TUJUAN_CACHE[k]);
    isiFilterPenerimaan();
    HALAMAN_SEKARANG = 1;
    renderTabelPenerimaan();
  } catch (err: any) {
    wrapEl.innerHTML = '<div class="text-center py-8 text-red-500"><i class="bi bi-exclamation-triangle text-xl"></i> Gagal memuat data.</div>';
    showMessage({ type: 'error', text: 'Gagal memuat data: ' + (err.message || err) });
  }
}

function isiFilterPenerimaan() {
  const asalSel = document.getElementById('filterAsalPenerimaan') as HTMLSelectElement | null;
  const tujuanSel = document.getElementById('filterTujuanPenerimaan') as HTMLSelectElement | null;
  const tujuanAkhirSel = document.getElementById('filterTujuanAkhirPenerimaan') as HTMLSelectElement | null;
  if (!asalSel || !tujuanSel || !tujuanAkhirSel) return;

  const asalNow = asalSel.value;
  const tujuanNow = tujuanSel.value;
  const tujuanAkhirNow = tujuanAkhirSel.value;

  const isi = (sel: HTMLSelectElement, values: string[], placeholder: string, current: string) => {
    const selected = current && values.includes(current) ? current : '';
    sel.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
  };

  isi(asalSel, uniqueValues(DAFTAR_TUJUAN_CACHE, (r: any) => r.cabangAsal), 'Semua Asal', asalNow);
  isi(tujuanSel, uniqueValues(DAFTAR_TUJUAN_CACHE, (r: any) => r.cabangTujuan), 'Semua Tujuan', tujuanNow);
  isi(tujuanAkhirSel, uniqueValues(DAFTAR_TUJUAN_CACHE, (r: any) => r.tujuanAkhir), 'Semua Tujuan Akhir', tujuanAkhirNow);
}

function renderTabelPenerimaan() {
  const cari = getFilterValue('filterCariPenerimaan').toLowerCase();
  const tanggal = getFilterValue('filterTanggalPenerimaan');
  const asal = getFilterValue('filterAsalPenerimaan');
  const tujuan = getFilterValue('filterTujuanPenerimaan');
  const tujuanAkhir = getFilterValue('filterTujuanAkhirPenerimaan');
  const wrap = document.getElementById('tabelPenerimaanWrap');
  const paginationWrap = document.getElementById('paginationPenerimaanWrap');
  if (!wrap) return;

  let data = DAFTAR_TUJUAN_CACHE;
  if (cari) data = data.filter((r: any) => (r.noSuratJalan || '').toLowerCase().includes(cari));
  if (tanggal) data = data.filter((r: any) => normalizeDate(r.tanggal) === tanggal);
  if (asal) data = data.filter((r: any) => (r.cabangAsal || '') === asal);
  if (tujuan) data = data.filter((r: any) => (r.cabangTujuan || '') === tujuan);
  if (tujuanAkhir) data = data.filter((r: any) => (r.tujuanAkhir || '') === tujuanAkhir);

  if (data.length === 0) {
    wrap.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="bi bi-inbox text-2xl mb-2 block"></i>Belum ada surat jalan yang harus diterima (atau sesuai filter).</div>';
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
  html += '<th class="p-2 text-center">Qty</th>';
  html += '<th class="p-2 text-left">Status</th>';
  html += '<th class="p-2 text-left">Tujuan Akhir</th>';
  html += '<th class="p-2 text-left">No Truk</th>';
  html += '<th class="p-2 text-left">Sopir</th>';
  html += '<th class="p-2 text-left">Dibuat Oleh</th>';
  html += '</tr></thead><tbody>';

  data.forEach((r: any) => {
    // Determine badge class based on status and whether it's transit or not
    const isLanjutan = r.perluDiteruskan === 'Ya';
    let badgeClass = 'bg-blue-100 text-blue-800'; // default: Menunggu Penerimaan / Dikirim
    
    if (isLanjutan) {
      // Transit items: Dikirim, Diterima Sebagian, Diterima Cikupa
      if (r.status === 'Diterima Cikupa') badgeClass = 'bg-green-100 text-green-800';
      else if (r.status === 'Diterima Sebagian') badgeClass = 'bg-yellow-100 text-yellow-800';
    } else {
      // Non-transit items: Menunggu Penerimaan, Diterima Sebagian, Diterima Tujuan
      if (r.status === 'Diterima Tujuan') badgeClass = 'bg-green-100 text-green-800';
      else if (r.status === 'Diterima Sebagian') badgeClass = 'bg-yellow-100 text-yellow-800';
      else if (r.status === 'Menunggu Penerimaan') badgeClass = 'bg-blue-100 text-blue-800';
    }

    const tujuanAkhirText = isLanjutan && r.tujuanAkhir ? r.tujuanAkhir : '<span class="text-slate-300">-</span>';
    const noTrukText = isLanjutan && r.noTruk ? r.noTruk : '<span class="text-slate-300">-</span>';
    const sopirText = isLanjutan && r.sopir ? r.sopir : '<span class="text-slate-300">-</span>';

    // Action buttons
    let aksi = `<button class="sj-btn-icon sj-btn-view" title="Lihat Detail" onclick="window._sj.toggleDetailPenerimaan('${r.id}')"><i class="bi bi-eye"></i></button>`;
    aksi += `<button class="sj-btn-icon sj-btn-confirm" title="Terima Barang" onclick="window._sj.bukaPenerimaanTujuan('${r.id}')"><i class="bi bi-clipboard-check"></i></button>`;

    html += `<tr class="border-b border-slate-100 hover:bg-slate-50/50 whitespace-nowrap">`;
    html += `<td class="p-2 text-sm">${aksi}</td>`;
    html += `<td class="p-2 font-mono text-sm">${r.noSuratJalan}</td>`;
    html += `<td class="p-2 text-sm">${r.tanggal}</td>`;
    html += `<td class="p-2 text-sm">${r.cabangAsal}</td>`;
    html += `<td class="p-2 text-center text-sm">${r.totalBarang}</td>`;
    html += `<td class="p-2"><span class="inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClass}">${r.status}</span></td>`;
    html += `<td class="p-2 text-sm">${tujuanAkhirText}</td>`;
    html += `<td class="p-2 text-sm font-mono text-xs">${noTrukText}</td>`;
    html += `<td class="p-2 text-sm">${sopirText}</td>`;
    html += `<td class="p-2 text-sm text-slate-500">${r.dibuatOleh}</td>`;
    html += `</tr>`;
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;

  if (paginationWrap) {
    renderPagination(paginationWrap, paged, (page) => {
      HALAMAN_SEKARANG = page;
      renderTabelPenerimaan();
    });
  }
}

// ============================================================
// MODAL VIEW DETAIL (READ-ONLY)
// ============================================================

async function toggleDetailPenerimaan(idSuratJalan: string) {
  const data = DAFTAR_TUJUAN_CACHE.find(r => r.id === idSuratJalan);
  if (!data) return;

  const section = document.getElementById('sectPenerimaanBarang')!;
  const modalWrap = section.querySelector('#modalPenerimaanTujuanWrap') as HTMLElement;
  const content = section.querySelector('#penerimaanTujuanContent') as HTMLElement;
  const noSuratEl = section.querySelector('#penerimaanTujuanNoSurat') as HTMLElement;
  const checkAll = section.querySelector('#penerimaanTujuanCheckAll') as HTMLInputElement;

  noSuratEl.textContent = data.noSuratJalan;
  checkAll.checked = false;
  content.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';

  modalWrap.style.display = 'flex';
  PENERIMAAN_ID = idSuratJalan;

  try {
    const [details, alamatList] = await Promise.all([
      DataService.getDetailSuratJalan(idSuratJalan),
      Api.getAlamatFullList(),
    ]);
    DETAIL_TUJUAN_CACHE[idSuratJalan] = details;

    // Lookup alamat tujuan
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
      const checked = sudahDiterima ? 'checked' : '';
      const disabled = sudahDiterima ? 'disabled' : '';

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
      barisTabel += `</td>`;
      barisTabel += `<td class="p-2 text-center text-sm">`;
      barisTabel += `<label class="flex items-center justify-center cursor-pointer select-none">`;
      barisTabel += `<input type="checkbox" class="checkbox checkbox-sm checkbox-primary penerimaan-tujuan-check" data-id-detail="${d.idDetail}" ${checked} ${disabled} />`;
      barisTabel += `</label>`;
      barisTabel += `</td>`;
      barisTabel += `</tr>`;
    });

    // Nama cabang asal
    const namaCabangAsal = alamatAsal?.site || data.cabangAsal;

    // Build HTML
    let h = '';

    // Company Header
    h += `<div class="flex items-start justify-between mb-4 pb-3 border-b border-slate-200">`;
    h += `<div>`;
    h += `<div class="font-bold text-lg text-slate-900">SURAT JALAN</div>`;
    h += `<div class="text-sm text-slate-500">No. ${data.noSuratJalan}</div>`;
    h += `</div>`;
    h += `<div class="text-right text-sm text-slate-500">`;
    h += `<div>Tanggal: ${data.tanggal}</div>`;
    h += `<div>Asal: ${namaCabangAsal}</div>`;
    h += `</div>`;
    h += `</div>`;

    // Kepada Yth
    h += `<div class="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">${kepadaHtml}</div>`;

    // Tabel barang
    h += `<div class="overflow-x-auto border border-slate-200 rounded-lg">`;
    h += `<table class="w-full text-sm">`;
    h += `<thead><tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold whitespace-nowrap">`;
    h += `<th class="p-2 text-center" style="width:40px;">No</th>`;
    h += `<th class="p-2 text-left">No Bukti</th>`;
    h += `<th class="p-2 text-left">Deskripsi</th>`;
    h += `<th class="p-2 text-center" style="width:60px;">Qty</th>`;
    h += `<th class="p-2 text-center" style="width:70px;">Satuan</th>`;
    h += `<th class="p-2 text-left">Keterangan</th>`;
    h += `<th class="p-2 text-center" style="width:100px;">Status Fisik</th>`;
    h += `<th class="p-2 text-center" style="width:60px;">Terima</th>`;
    h += `</tr></thead><tbody>${barisTabel}</tbody></table>`;
    h += `</div>`;

    // Total
    h += `<div class="mt-3 text-right text-sm font-semibold text-slate-700">Total Qty: ${totalQty}</div>`;

    // Tanda tangan
    h += `<div class="mt-6 grid grid-cols-3 gap-4 text-sm">`;
    h += `<div class="text-center">`;
    h += `<div class="mb-1">Dikirim Oleh</div>`;
    h += `<div class="h-16 border-b border-slate-300"></div>`;
    h += `<div class="mt-1 font-medium">${data.dikirimVia || '-'}</div>`;
    h += `</div>`;
    h += `<div class="text-center">`;
    h += `<div class="mb-1">Mengetahui</div>`;
    h += `<div class="h-16 border-b border-slate-300"></div>`;
    h += `<div class="mt-1 font-medium">${picMengetahui}</div>`;
    h += `</div>`;
    h += `<div class="text-center">`;
    h += `<div class="mb-1">Diterima Oleh</div>`;
    h += `<div class="h-16 border-b border-slate-300"></div>`;
    h += `<div class="mt-1 font-medium">${alamatTujuan?.pic || '-'}</div>`;
    h += `</div>`;
    h += `</div>`;

    content.innerHTML = h;
  } catch (e: any) {
    content.innerHTML = '<div class="text-center py-8 text-red-500">Gagal memuat detail.</div>';
    showMessage({ type: 'error', text: 'Gagal memuat detail: ' + (e.message || e) });
  }
}

// ============================================================
// SUBMIT PENERIMAAN
// ============================================================

async function submitPenerimaanTujuan(tabelWrap: HTMLElement) {
  if (!PENERIMAAN_ID) return;

  const section = document.getElementById('sectPenerimaanBarang')!;
  const checkboxes = section.querySelectorAll('.penerimaan-tujuan-check') as NodeListOf<HTMLInputElement>;
  const items: any[] = [];
  checkboxes.forEach(cb => {
    items.push({
      idDetail: cb.dataset.idDetail!,
      diterima: cb.checked
    });
  });

  const user = AuthService.getCurrentUser();
  if (!user) return;

  const btnSimpan = section.querySelector('#btnSimpanPenerimaanTujuan') as HTMLButtonElement;
  const origText = btnSimpan.textContent;
  btnSimpan.disabled = true;
  btnSimpan.textContent = '⏳ Menyimpan...';

  try {
    const result = await DataService.terimaBarangTujuan(PENERIMAAN_ID, items, user.role, user.username, user.cabang);
    if (result.success) {
      showMessage({ type: 'success', text: 'Penerimaan barang berhasil disimpan.' });
      const modalWrap = section.querySelector('#modalPenerimaanTujuanWrap') as HTMLElement;
      modalWrap.style.display = 'none';
      PENERIMAAN_ID = null;
      muatDaftarPenerimaan(tabelWrap);
    } else {
      showMessage({ type: 'error', text: result.message || 'Gagal menyimpan penerimaan.' });
    }
  } catch (err: any) {
    showMessage({ type: 'error', text: err.message || 'Gagal menyimpan penerimaan.' });
  } finally {
    btnSimpan.disabled = false;
    btnSimpan.textContent = origText;
  }
}

// ============================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================

if (typeof window !== 'undefined') {
  (window as any)._sj = (window as any)._sj || {};
  (window as any)._sj.toggleDetailPenerimaan = toggleDetailPenerimaan;
  (window as any)._sj.bukaPenerimaanTujuan = (id: string) => {
    const section = document.getElementById('sectPenerimaanBarang')!;
    const modalWrap = section.querySelector('#modalPenerimaanTujuanWrap') as HTMLElement;
    const content = section.querySelector('#penerimaanTujuanContent') as HTMLElement;
    const noSuratEl = section.querySelector('#penerimaanTujuanNoSurat') as HTMLElement;
    const checkAll = section.querySelector('#penerimaanTujuanCheckAll') as HTMLInputElement;

    const data = DAFTAR_TUJUAN_CACHE.find(r => r.id === id);
    if (!data) return;

    noSuratEl.textContent = data.noSuratJalan;
    checkAll.checked = false;
    content.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
    modalWrap.style.display = 'flex';
    PENERIMAAN_ID = id;

    // Load detail
    DataService.getDetailSuratJalan(id).then(details => {
      DETAIL_TUJUAN_CACHE[id] = details;
      // Re-render the modal content
      toggleDetailPenerimaan(id);
    }).catch(err => {
      content.innerHTML = '<div class="text-center py-8 text-red-500">Gagal memuat detail.</div>';
      showMessage({ type: 'error', text: 'Gagal memuat detail: ' + (err.message || err) });
    });
  };
}