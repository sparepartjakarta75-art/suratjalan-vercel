import { DataService } from '../services/data';
import { showMessage } from '../utils/messaging';

// ============================================================
// KIRIMAN PENDING (Barang Penerimaan Eksternal yang belum dikirim/close)
// Status: Open (belum dibuatkan SJ) | Pending (sudah masuk SJ, belum diterima tujuan)
// ============================================================

let kpListData: any[] = [];

export function renderKirimanPending(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectKirimanPending';
  section.style.display = 'none';
  section.className = 'space-y-4';

  section.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
          <h2 class="text-lg font-bold text-slate-900"><i class="bi bi-send me-1"></i> Kiriman Pending</h2>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" id="kpSearchInput" class="sj-input pl-9 pr-8 py-2 text-sm w-64" placeholder="Cari no bukti / deskripsi..." />
            <button id="kpSearchClear" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" style="display:none;"><i class="bi bi-x-circle"></i></button>
          </div>
          <select id="kpFilterStatus" class="sj-select py-2 text-sm w-40">
            <option value="">Semua Status</option>
            <option value="Open">Open</option>
            <option value="Pending">Pending</option>
          </select>
          <button id="kpBtnRefresh" class="sj-btn-view inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium">
            <i class="bi bi-arrow-clockwise"></i><span>Muat Ulang</span>
          </button>
        </div>
      </div>
      <div id="kpDaftarWrap" class="overflow-x-auto"></div>
    </div>
  `;

  setupKirimanPendingEvents(section);
  return section;
}

function setupKirimanPendingEvents(section: HTMLElement) {
  const searchInput = section.querySelector('#kpSearchInput') as HTMLInputElement;
  const searchClear = section.querySelector('#kpSearchClear') as HTMLButtonElement;
  const filterStatus = section.querySelector('#kpFilterStatus') as HTMLSelectElement;
  const refreshBtn = section.querySelector('#kpBtnRefresh') as HTMLButtonElement;

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    searchClear.style.display = term ? '' : 'none';
    renderKPList(section, term);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    renderKPList(section, '');
  });

  filterStatus.addEventListener('change', () => {
    renderKPList(section, searchInput.value.trim().toLowerCase());
  });

  refreshBtn.addEventListener('click', () => loadKPList(section));

  window.addEventListener('view-kiriman-pending', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    filterStatus.value = '';
    loadKPList(section);
  });
}

async function loadKPList(section: HTMLElement) {
  const wrap = section.querySelector('#kpDaftarWrap') as HTMLElement;
  wrap.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
  try {
    const list = await DataService.loadDaftarKirimanPending();
    kpListData = list || [];
    renderKPList(section, (section.querySelector('#kpSearchInput') as HTMLInputElement).value.trim().toLowerCase());
  } catch (err: any) {
    wrap.innerHTML = '<div class="text-center py-8 text-red-500"><i class="bi bi-exclamation-triangle text-xl"></i> Gagal memuat data.</div>';
    showMessage({ type: 'error', text: 'Gagal memuat data: ' + (err.message || err) });
  }
}

function renderKPList(section: HTMLElement, searchTerm: string) {
  const wrap = section.querySelector('#kpDaftarWrap') as HTMLElement;

  if (!kpListData || kpListData.length === 0) {
    wrap.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="bi bi-check2-circle text-2xl mb-2 block"></i>Tidak ada kiriman pending. Semua barang eksternal sudah diterima tujuan (Close).</div>';
    return;
  }

  const filterStatus = (section.querySelector('#kpFilterStatus') as HTMLSelectElement).value;
  let filteredList = kpListData.filter((r: any) => {
    if (filterStatus && r.statusKirim !== filterStatus) return false;
    if (searchTerm && ![
      r.noBukti, r.deskripsi, r.tujuanSite, r.noSJKirim, r.sumber, r.noSuratPenerimaan
    ].some((val) => val && String(val).toLowerCase().includes(searchTerm))) return false;
    return true;
  });

  if (filteredList.length === 0) {
    wrap.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="bi bi-search text-2xl mb-2 block"></i>Tidak ada data yang cocok.</div>';
    return;
  }

  let html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold whitespace-nowrap">';
  html += '<th class="p-2 text-left">No Bukti</th>';
  html += '<th class="p-2 text-left">Deskripsi</th>';
  html += '<th class="p-2 text-center">Qty</th>';
  html += '<th class="p-2 text-left">Satuan</th>';
  html += '<th class="p-2 text-left">Tujuan</th>';
  html += '<th class="p-2 text-left">Sumber</th>';
  html += '<th class="p-2 text-left">No. Penerimaan</th>';
  html += '<th class="p-2 text-center">No. SJ Kirim</th>';
  html += '<th class="p-2 text-center">Status</th>';
  html += '</tr></thead><tbody>';

  filteredList.forEach((r: any) => {
    const status = r.statusKirim;
    const badge = status === 'Pending'
      ? '<span class="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">Pending</span>'
      : '<span class="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">Open</span>';
    html += '<tr class="border-b border-slate-100 hover:bg-slate-50/50 whitespace-nowrap">';
    html += `<td class="p-2 font-mono text-xs">${r.noBukti || '-'}</td>`;
    html += `<td class="p-2">${r.deskripsi || '-'}</td>`;
    html += `<td class="p-2 text-center font-semibold">${r.qty}</td>`;
    html += `<td class="p-2">${r.satuan || '-'}</td>`;
    html += `<td class="p-2"><span class="inline-block text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">${r.tujuanSite || '-'}</span></td>`;
    html += `<td class="p-2"><span class="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">${r.sumber || '-'}</span></td>`;
    html += `<td class="p-2 font-mono text-xs">${r.noSuratPenerimaan || '-'}</td>`;
    html += `<td class="p-2 font-mono text-xs">${r.noSJKirim || '<span class="text-slate-300">-</span>'}</td>`;
    html += `<td class="p-2 text-center">${badge}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}