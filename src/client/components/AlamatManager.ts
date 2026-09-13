import { GasAPI } from '../utils/gas-wrapper';
import { showMessage } from '../utils/messaging';
import { paginate, getFilterValue, renderPagination, UKURAN_HALAMAN } from '../utils/pagination';

const COLUMNS = [
  { key: 'site',        label: 'SITE' },
  { key: 'wilayah',     label: 'Wilayah' },
  { key: 'pengirim',    label: 'Pengirim' },
  { key: 'pic',         label: 'PIC' },
  { key: 'dept',        label: 'Dept' },
  { key: 'alamat',      label: 'Alamat' },
  { key: 'kelurahan',   label: 'Kelurahan' },
  { key: 'kecamatan',   label: 'Kecamatan' },
  { key: 'kota',        label: 'Kota' },
  { key: 'tlp',         label: 'TLP' },
];

let allData: any[] = [];
let editingSite: string | null = null; // null = mode tambah
let HALAMAN_SEKARANG = 1;

export function renderAlamatManager(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectAlamatManager';
  section.style.display = 'none';

  section.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <i class="bi bi-geo-alt-fill text-blue-600"></i>
          Kelola Alamat
        </h2>
      </div>
      <button id="btnTambahAlamat" class="sj-btn-primary">
        <i class="bi bi-plus-circle"></i>
        <span>Tambah Alamat</span>
      </button>
    </div>

    <!-- Table Container -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div class="p-3 border-b border-slate-100">
        <input 
          type="text" 
          id="filterCariAlamat" 
          class="sj-input w-full md:w-80" 
          placeholder="Cari site, wilayah, kota, PIC..." 
        />
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200" id="alamatTableHead"></tr>
          </thead>
          <tbody id="alamatTableBody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="alamatEmptyState" class="hidden p-8 text-center text-slate-400">
        <i class="bi bi-inbox text-4xl mb-2"></i>
        <p>Belum ada data alamat.</p>
      </div>
      <div id="alamatPaginationWrap" class="px-4 py-3 border-t border-slate-100"></div>
    </div>

    <!-- Form Modal Overlay -->
    <div id="alamatFormOverlay" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 id="alamatFormTitle" class="text-lg font-bold text-slate-800">Tambah Alamat</h3>
          <button id="btnCloseForm" class="text-slate-400 hover:text-slate-600 text-xl"><i class="bi bi-x-lg"></i></button>
        </div>
        <form id="alamatForm" class="px-6 py-4 space-y-3"></form>
      </div>
    </div>
  `;

  return section;
}

export function setupAlamatManagerEvents() {
  document.getElementById('btnTambahAlamat')?.addEventListener('click', () => openForm(null));

  window.addEventListener('view-alamat-triggered', () => {
    loadData();
  });

  document.getElementById('btnCloseForm')?.addEventListener('click', closeForm);
  document.getElementById('alamatFormOverlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'alamatFormOverlay') closeForm();
  });

  document.getElementById('filterCariAlamat')?.addEventListener('input', () => {
    HALAMAN_SEKARANG = 1;
    loadData();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadData() {
  const tbody = document.getElementById('alamatTableBody');
  const thead = document.getElementById('alamatTableHead');
  const emptyState = document.getElementById('alamatEmptyState');
  const paginationWrap = document.getElementById('alamatPaginationWrap');
  if (!tbody || !thead || !emptyState) return;

  // Build header
  thead.innerHTML = '<th class="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>' +
    COLUMNS.map(c =>
      `<th class="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">${c.label}</th>`
    ).join('');

  // Fetch data
  try {
    allData = await GasAPI.getAlamatFullList();
  } catch {
    allData = [];
  }

  // Apply search filter
  const cari = getFilterValue('filterCariAlamat').toLowerCase();
  let filtered = allData;
  if (cari) {
    filtered = allData.filter((row: any) =>
      COLUMNS.some(c => row[c.key] && String(row[c.key]).toLowerCase().includes(cari))
    );
  }

  if (!filtered.length) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (paginationWrap) paginationWrap.innerHTML = '';
    return;
  }
  emptyState.classList.add('hidden');

  const paged = paginate(filtered, HALAMAN_SEKARANG, UKURAN_HALAMAN);

  tbody.innerHTML = paged.items.map(row => {
    const siteVal = row.site || '';
    const cells = COLUMNS.map(c =>
      `<td class="px-3 py-2 whitespace-nowrap text-slate-700" title="${row[c.key] || ''}">${row[c.key] || '-'}</td>`
    ).join('');
    return `
      <tr class="hover:bg-blue-50/50 transition-colors" data-site="${siteVal}">
        <td class="px-3 py-2 whitespace-nowrap">
          <div class="flex gap-1.5">
            <button class="sj-btn-icon sj-btn-edit" title="Edit" data-action="edit" data-site="${siteVal}">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="sj-btn-icon sj-btn-delete" title="Hapus" data-action="delete" data-site="${siteVal}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Event delegation for edit/delete
  tbody.onclick = (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
    if (!btn) return;
    const site = btn.dataset.site!;
    if (btn.dataset.action === 'edit') {
      const row = allData.find(r => r.site === site);
      if (row) openForm(row);
    } else if (btn.dataset.action === 'delete') {
      confirmDelete(site);
    }
  };

  if (paginationWrap) {
    renderPagination(paginationWrap, paged, (page) => {
      HALAMAN_SEKARANG = page;
      loadData();
    });
  }
}

// ============================================================
// FORM (ADD / EDIT)
// ============================================================

const FORM_FIELDS = [
  { name: 'site',      label: 'SITE *',  type: 'text', required: true },
  { name: 'wilayah',   label: 'Wilayah',  type: 'text' },
  { name: 'pengirim',  label: 'Pengirim', type: 'text' },
  { name: 'pic',       label: 'PIC',      type: 'text' },
  { name: 'dept',      label: 'Dept',     type: 'text' },
  { name: 'alamat',    label: 'Alamat',   type: 'text' },
  { name: 'kelurahan', label: 'Kelurahan', type: 'text' },
  { name: 'kecamatan', label: 'Kecamatan', type: 'text' },
  { name: 'kota',      label: 'Kota',     type: 'text' },
  { name: 'tlp',       label: 'TLP',      type: 'text' },
];

function openForm(row: any | null) {
  editingSite = row?.site || null;
  const overlay = document.getElementById('alamatFormOverlay');
  const formEl = document.getElementById('alamatForm') as HTMLFormElement;
  const titleEl = document.getElementById('alamatFormTitle');
  if (!overlay || !formEl || !titleEl) return;

  titleEl.textContent = editingSite ? 'Edit Alamat' : 'Tambah Alamat';

  formEl.innerHTML = FORM_FIELDS.map(f => {
    const val = row ? (row[f.name] || '') : '';
    const isSiteEditing = f.name === 'site' && editingSite;
    const readonly = isSiteEditing ? 'readonly' : '';
    const readonlyCls = readonly ? 'sj-input-readonly' : 'sj-input';
    return `
      <div>
        <label class="block text-xs font-semibold text-slate-500 mb-1">${f.label}</label>
        <input name="${f.name}" type="${f.type}" value="${val}" ${f.required ? 'required' : ''} ${readonly}
          class="w-full sj-input-sm ${readonlyCls}" placeholder="${f.label.replace(' *', '')}" />
      </div>
    `;
  }).join('');

  formEl.innerHTML += `
    <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
      <button type="button" id="btnCancelForm" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
        <i class="bi bi-x-circle"></i> Batal
      </button>
      <button type="submit" class="sj-btn-primary inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
        <i class="bi bi-check2-circle"></i> Simpan
      </button>
    </div>
  `;

  document.getElementById('btnCancelForm')?.addEventListener('click', closeForm);

  formEl.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(formEl);
    const payload: Record<string, string> = {};
    FORM_FIELDS.forEach(f => { payload[f.name] = String(formData.get(f.name) || ''); });
    if (!payload.site) { showMessage('SITE wajib diisi.', 'error'); return; }

    const btn = formEl.querySelector('[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Menyimpan...';

    try {
      await GasAPI.simpanAlamat(payload);
      showMessage(editingSite ? 'Alamat berhasil diupdate.' : 'Alamat berhasil ditambahkan.', 'success');
      closeForm();
      loadData();
    } catch (err: any) {
      showMessage(err.message || 'Gagal menyimpan alamat.', 'error');
    } finally {
      btn.disabled = false;
    }
  };

  overlay.classList.remove('hidden');
}

function closeForm() {
  editingSite = null;
  document.getElementById('alamatFormOverlay')?.classList.add('hidden');
}

// ============================================================
// DELETE CONFIRMATION
// ============================================================

function confirmDelete(site: string) {
  const overlay = document.getElementById('alamatFormOverlay');
  const formEl = document.getElementById('alamatForm') as HTMLFormElement;
  const titleEl = document.getElementById('alamatFormTitle');
  if (!overlay || !formEl || !titleEl) return;

  titleEl.textContent = 'Hapus Alamat?';
  formEl.innerHTML = `
    <p class="text-slate-600 text-sm mb-4">
      Apakah Anda yakin ingin menghapus alamat <strong>${site}</strong>?<br/>
      Tindakan ini tidak dapat dibatalkan.
    </p>
    <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
      <button type="button" id="btnCancelDel" class="sj-btn-icon sj-btn-cancel w-auto px-4 gap-1.5 text-sm font-medium">
        <i class="bi bi-x-lg"></i> Batal
      </button>
      <button type="button" id="btnConfirmDel" class="sj-btn-icon sj-btn-delete w-auto px-4 gap-1.5 text-sm font-medium">
        <i class="bi bi-trash"></i> Hapus
      </button>
    </div>
  `;

  document.getElementById('btnCancelDel')?.addEventListener('click', closeForm);

  document.getElementById('btnConfirmDel')?.addEventListener('click', async () => {
    try {
      await GasAPI.hapusAlamat(site);
      showMessage('Alamat berhasil dihapus.', 'success');
      closeForm();
      loadData();
    } catch (err: any) {
      showMessage(err.message || 'Gagal menghapus alamat.', 'error');
    }
  });

  overlay.classList.remove('hidden');
}
