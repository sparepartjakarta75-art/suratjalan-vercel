import { DataService } from '../services/data';
import { AuthService } from '../services/auth';
import { Api } from '../utils/api-client';
import { showMessage } from '../utils/messaging';

// ============================================================
// STATE
// ============================================================

let EDITING_ID: string | null = null;
let DETAIL_ROW_COUNT = 0;

// ============================================================
// RENDER
// ============================================================

export function renderEditSuratJalan(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectEditSuratJalan';
  section.style.display = 'none';
  section.className = 'space-y-4';

  section.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
          <h2 class="text-lg font-bold text-slate-900"><i class="bi bi-pencil"></i> Edit Surat Jalan</h2>
        </div>
        <span id="editNoSurat" class="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-mono font-semibold"></span>
      </div>

      <div id="editWarningStatus" class="hidden mx-5 mt-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"></div>

      <div class="p-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Asal</label>
            <select id="eCabangAsal" class="sj-select"></select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Tujuan</label>
            <select id="eCabangTujuan" class="sj-select"></select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Kode Jenis Barang</label>
            <select id="eJenisBarang" class="sj-select"></select>
          </div>
        </div>

        <!-- Pengirim (Dari) Info -->
        <div id="pengirimInfoEdit" class="hidden bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div class="flex items-center gap-2 mb-2">
            <i class="bi bi-person-fill text-green-600"></i>
            <span class="font-semibold text-green-800">Pengirim (Dari)</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span class="text-green-700 font-medium">Nama:</span>
              <span id="pengirimNamaEdit" class="ml-2 text-slate-900"></span>
            </div>
            <div>
              <span class="text-green-700 font-medium">Dept:</span>
              <span id="pengirimDeptEdit" class="ml-2 text-slate-900"></span>
            </div>
            <div>
              <span class="text-green-700 font-medium">Telp:</span>
              <span id="pengirimTlpEdit" class="ml-2 text-slate-900"></span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-semibold text-slate-700 mb-1">Dikirim Via <span class="text-slate-400 font-normal">(opsional)</span></label>
          <input type="text" id="eDikirimVia" class="sj-input" placeholder="cth: Bp. Sujarwo &rarr; Bp. Maryono" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Transit</label>
            <select id="ePerluDiteruskan" class="sj-select">
              <option value="Tidak">Tidak</option>
              <option value="Ya">Ya</option>
            </select>
          </div>
          <div id="wrapTujuanAkhirEdit" class="hidden md:col-span-2">
            <label class="block text-sm font-semibold text-slate-700 mb-1">Tujuan Akhir</label>
            <select id="eTujuanAkhir" class="sj-select">
              <option value="">-- Pilih tujuan akhir --</option>
            </select>
          </div>
        </div>

        <p class="text-xs text-slate-400 mb-4">
          <i class="bi bi-info-circle me-1"></i>Semua kolom bisa diubah selama status belum "Diterima Cikupa".
        </p>

        <h6 class="text-sm font-bold text-blue-700 mb-3"><i class="bi bi-box-seam me-1"></i>Detail Barang</h6>
        <div class="overflow-x-auto mb-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th class="p-2 text-center" style="width:36px;">No</th>
                <th class="p-2 text-left">No Bukti</th>
                <th class="p-2 text-left">Deskripsi</th>
                <th class="p-2 text-center" style="width:90px;">Qty</th>
                <th class="p-2 text-center" style="width:90px;">Satuan</th>
                <th class="p-2 text-left">Keterangan</th>
                <th class="p-2" style="width:40px;"></th>
              </tr>
            </thead>
            <tbody id="detailRowsEdit"></tbody>
          </table>
        </div>
          <button id="btnTambahBarisEdit" class="sj-btn-view inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium">
            <i class="bi bi-plus-lg"></i>Tambah Baris
          </button>

        <div class="mt-5 pt-4 border-t border-slate-200 flex gap-2">
          <button id="btnSubmitEdit" class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm">
            <i class="bi bi-check2-circle"></i>Update Surat Jalan
          </button>
          <button id="btnCancelEdit" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium">
            <i class="bi bi-x-circle"></i>Batal
          </button>
        </div>
      </div>
    </div>
  `;

  setupEditEvents(section);
  return section;
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupEditEvents(section: HTMLElement) {
  const perluSelect = section.querySelector('#ePerluDiteruskan') as HTMLSelectElement;
  const btnTambah = section.querySelector('#btnTambahBarisEdit') as HTMLButtonElement;
  const btnSubmit = section.querySelector('#btnSubmitEdit') as HTMLButtonElement;
  const btnCancel = section.querySelector('#btnCancelEdit') as HTMLButtonElement;

  perluSelect.addEventListener('change', async () => {
    const wrap = section.querySelector('#wrapTujuanAkhirEdit') as HTMLElement;
    if (perluSelect.value === 'Ya') {
      await loadTujuanAkhirOptions();
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
      (section.querySelector('#eTujuanAkhir') as HTMLSelectElement).value = '';
    }
  });
  btnTambah.addEventListener('click', () => tambahBarisDetailEdit());
  btnSubmit.addEventListener('click', () => submitUpdateSuratJalan());
  btnCancel.addEventListener('click', () => {
    EDITING_ID = null;
    section.style.display = 'none';
    window.dispatchEvent(new CustomEvent('view-list-triggered'));
  });

  // Listen for edit-surat event from ListSuratJalan
  window.addEventListener('edit-surat', ((e: CustomEvent) => {
    mulaiEdit(e.detail.id);
  }) as EventListener);
}

// ============================================================
// LOAD DATA & PREFILL
// ============================================================

async function mulaiEdit(id: string) {
  const section = document.getElementById('sectEditSuratJalan')!;
  const user = AuthService.getCurrentUser();

  try {
    const data = await DataService.getSuratJalanForEdit(id);
    if (!data || !data.success) {
      showMessage({ type: 'error', text: data?.message || 'Gagal memuat data.' });
      return;
    }

    EDITING_ID = id;
    const header = data.header;
    const details = data.details || [];

    // Block edit if items have already been received at final destination
    const status = header.status || '';
    if (status === 'Diterima Cikupa' || status === 'Diterima Tujuan') {
      showMessage({ type: 'error', text: 'Surat jalan yang sudah diterima ("' + status + '") tidak bisa diubah.' });
      return;
    }

    (section.querySelector('#editNoSurat') as HTMLElement).textContent = header.noSuratJalan;

    // Warning if status is "Menunggu Penerimaan" (non-transit, no items received yet but status differs from "Dikirim")
    const warnBox = section.querySelector('#editWarningStatus') as HTMLElement;
    if (header.status === 'Menunggu Penerimaan') {
      warnBox.textContent = 'Perhatian: status saat ini "Menunggu Penerimaan". Menyimpan perubahan akan MERESET status fisik semua item ke "Belum Diterima".';
      warnBox.classList.remove('hidden');
    } else {
      warnBox.classList.add('hidden');
    }

    // Load referensi data ke dropdown
    await loadReferensiDataEdit(header.cabangAsal, header.cabangTujuan, header.kodeJenis);

    (section.querySelector('#eDikirimVia') as HTMLInputElement).value = header.dikirimVia || '';
    (section.querySelector('#ePerluDiteruskan') as HTMLSelectElement).value = header.perluDiteruskan === 'Ya' ? 'Ya' : 'Tidak';
    (section.querySelector('#eTujuanAkhir') as HTMLSelectElement).value = header.tujuanAkhir || '';

    // Populate pengirim info from ALAMAT sheet based on asal
    const alamatFull = await Api.getAlamatFullList();
    const alamatAsal = alamatFull.find((a: any) => a.site === header.cabangAsal);
    if (alamatAsal) {
      const pengirimInfo = section.querySelector('#pengirimInfoEdit') as HTMLElement;
      const pengirimNama = section.querySelector('#pengirimNamaEdit') as HTMLElement;
      const pengirimDept = section.querySelector('#pengirimDeptEdit') as HTMLElement;
      const pengirimTlp = section.querySelector('#pengirimTlpEdit') as HTMLElement;
      
      pengirimNama.textContent = alamatAsal.pengirim || '-';
      pengirimDept.textContent = alamatAsal.dept || '-';
      pengirimTlp.textContent = alamatAsal.tlp || '-';
      pengirimInfo.classList.remove('hidden');
    }

    // Load tujuan akhir options
    await loadTujuanAkhirOptions(header.tujuanAkhir);

    toggleTujuanAkhirEdit();

    // Clear and populate detail rows
    const tbody = section.querySelector('#detailRowsEdit') as HTMLElement;
    tbody.innerHTML = '';
    DETAIL_ROW_COUNT = 0;
    details.forEach((d: any) => tambahBarisDetailEdit(d));

    // Show edit section, hide others
    window.dispatchEvent(new CustomEvent('show-section', { detail: { sectionId: 'sectEditSuratJalan' } }));
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal memuat data untuk edit: ' + err.message });
  }
}

async function loadReferensiDataEdit(selectedCabangAsal?: string, selectedCabangTujuan?: string, selectedKodeJenis?: string) {
  const section = document.getElementById('sectEditSuratJalan')!;
  try {
    const [alamatList, jenisBarangList] = await Promise.all([
      DataService.loadAlamatList(),
      DataService.loadJenisBarangList()
    ]);

    // Cabang Asal
    const asalSel = section.querySelector('#eCabangAsal') as HTMLSelectElement;
    asalSel.innerHTML = '';
    alamatList.forEach((a: any) => {
      const opt = document.createElement('option');
      opt.value = a.site || '';
      opt.textContent = a.site + (a.wilayah ? ` - ${a.wilayah}` : '');
      asalSel.appendChild(opt);
    });
    if (selectedCabangAsal) asalSel.value = selectedCabangAsal;

    // Cabang Tujuan
    const tujuanSel = section.querySelector('#eCabangTujuan') as HTMLSelectElement;
    tujuanSel.innerHTML = '';
    alamatList.forEach((a: any) => {
      const opt = document.createElement('option');
      opt.value = a.site || '';
      opt.textContent = a.site + (a.wilayah ? ` - ${a.wilayah}` : '');
      tujuanSel.appendChild(opt);
    });
    if (selectedCabangTujuan) tujuanSel.value = selectedCabangTujuan;

    // Kode Jenis Barang
    const jenisSel = section.querySelector('#eJenisBarang') as HTMLSelectElement;
    jenisSel.innerHTML = '';
    jenisBarangList.forEach((j: any) => {
      const opt = document.createElement('option');
      opt.value = j.Kode || '';
      opt.textContent = j.Kode + (j['Nama Jenis'] ? ` - ${j['Nama Jenis']}` : '');
      jenisSel.appendChild(opt);
    });
    if (selectedKodeJenis) jenisSel.value = selectedKodeJenis;
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal memuat data referensi: ' + err.message });
  }
}

async function loadTujuanAkhirOptions(selectedValue?: string) {
  const section = document.getElementById('sectEditSuratJalan')!;
  const sel = section.querySelector('#eTujuanAkhir') as HTMLSelectElement;

  try {
    const alamatList = await DataService.loadAlamatList();
    sel.innerHTML = '<option value="">-- Pilih tujuan akhir --</option>';
    alamatList.forEach((a: any) => {
      const opt = document.createElement('option');
      opt.value = a.site || '';
      opt.textContent = a.site + (a.wilayah ? ` - ${a.wilayah}` : '');
      sel.appendChild(opt);
    });
    if (selectedValue) sel.value = selectedValue;
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal memuat data alamat: ' + err.message });
  }
}

// ============================================================
// TOGGLE TUJUAN AKHIR
// ============================================================

function toggleTujuanAkhirEdit() {
  const section = document.getElementById('sectEditSuratJalan')!;
  const perlu = (section.querySelector('#ePerluDiteruskan') as HTMLSelectElement).value;
  const wrap = section.querySelector('#wrapTujuanAkhirEdit') as HTMLElement;

  if (perlu === 'Ya') {
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
    (section.querySelector('#eTujuanAkhir') as HTMLSelectElement).value = '';
  }
}

// ============================================================
// DETAIL ROWS
// ============================================================

function tambahBarisDetailEdit(prefill?: any) {
  DETAIL_ROW_COUNT++;
  const rowId = 'erow_' + DETAIL_ROW_COUNT;
  const tbody = document.getElementById('detailRowsEdit')!;
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.className = 'border-b border-slate-100';
  tr.innerHTML =
    `<td class="p-2 text-center font-semibold text-slate-400">${tbody.children.length + 1}</td>` +
    `<td class="p-1"><input type="text" class="sj-input sj-input-sm d-nobukti" placeholder="cth: KAP/TGR/SV/26/04/001" /></td>` +
    `<td class="p-1"><input type="text" class="sj-input sj-input-sm d-deskripsi" placeholder="cth: SPAREPART HA NON MKS" /></td>` +
    `<td class="p-1"><input type="number" min="1" class="sj-input sj-input-sm d-qty text-center" placeholder="1" /></td>` +
    `<td class="p-1"><select class="sj-select sj-select-sm d-satuan"><option value="">--</option><option value="EA">EA</option><option value="COLLY">COLLY</option><option value="BOX">BOX</option><option value="SET">SET</option><option value="PCS">PCS</option><option value="KG">KG</option><option value="ROLL">ROLL</option><option value="PACK">PACK</option><option value="UNIT">UNIT</option></select></td>` +
    `<td class="p-1"><input type="text" class="sj-input sj-input-sm d-keterangan" placeholder="opsional" /></td>` +
    `<td class="p-2 text-center"><button class="sj-btn-icon sj-btn-delete text-xs" onclick="window._sjEdit.hapusBaris('${rowId}')"><i class="bi bi-x-lg"></i></button></td>`;
  tbody.appendChild(tr);

  if (prefill) {
    (tr.querySelector('.d-nobukti') as HTMLInputElement).value = prefill.noBukti || '';
    (tr.querySelector('.d-deskripsi') as HTMLInputElement).value = prefill.deskripsi || '';
    (tr.querySelector('.d-qty') as HTMLInputElement).value = prefill.qty || '';
    (tr.querySelector('.d-satuan') as HTMLSelectElement).value = prefill.satuan || '';
    (tr.querySelector('.d-keterangan') as HTMLInputElement).value = prefill.keterangan || '';
  }
}

function hapusBaris(rowId: string) {
  const el = document.getElementById(rowId);
  if (el) el.remove();
  // Re-number
  const rows = document.querySelectorAll('#detailRowsEdit tr');
  rows.forEach((tr, i) => {
    const firstTd = tr.querySelector('td');
    if (firstTd) firstTd.textContent = String(i + 1);
  });
}

// ============================================================
// COLLECT & SUBMIT
// ============================================================

function ambilDataDetailEdit(): any[] {
  const rows = document.querySelectorAll('#detailRowsEdit tr');
  const details: any[] = [];
  rows.forEach((tr) => {
    details.push({
      noBukti: (tr.querySelector('.d-nobukti') as HTMLInputElement)?.value?.trim() || '',
      deskripsi: (tr.querySelector('.d-deskripsi') as HTMLInputElement)?.value?.trim() || '',
      qty: (tr.querySelector('.d-qty') as HTMLInputElement)?.value || '',
      satuan: (tr.querySelector('.d-satuan') as HTMLSelectElement)?.value?.trim() || '',
      keterangan: (tr.querySelector('.d-keterangan') as HTMLInputElement)?.value?.trim() || '',
    });
  });
  return details;
}

async function submitUpdateSuratJalan() {
  if (!EDITING_ID) return;

  const section = document.getElementById('sectEditSuratJalan')!;
  const details = ambilDataDetailEdit();

  if (details.length === 0) {
    showMessage({ type: 'error', text: 'Tambahkan minimal 1 baris detail barang.' });
    return;
  }

  for (let i = 0; i < details.length; i++) {
    if (!details[i].deskripsi || !details[i].qty) {
      showMessage({ type: 'error', text: `Baris ke-${i + 1}: Deskripsi dan Qty wajib diisi.` });
      return;
    }
  }

  const perluDiteruskan = (section.querySelector('#ePerluDiteruskan') as HTMLSelectElement).value;
  const tujuanAkhir = (section.querySelector('#eTujuanAkhir') as HTMLSelectElement).value.trim();

  if (perluDiteruskan === 'Ya' && !tujuanAkhir) {
    showMessage({ type: 'error', text: 'Tujuan Akhir wajib diisi jika transit aktif.' });
    return;
  }

  const user = AuthService.getCurrentUser();
  const payload = {
    cabangAsal: (section.querySelector('#eCabangAsal') as HTMLSelectElement).value,
    cabangTujuan: (section.querySelector('#eCabangTujuan') as HTMLSelectElement).value,
    kodeJenis: (section.querySelector('#eJenisBarang') as HTMLSelectElement).value,
    dikirimVia: (section.querySelector('#eDikirimVia') as HTMLInputElement).value.trim(),
    perluDiteruskan,
    tujuanAkhir,
    details,
    role: user?.role,
    cabang: user?.cabang,
    username: user?.username,
  };

  try {
    const result = await DataService.updateSuratJalan(EDITING_ID, payload);
    if (!result.success) {
      showMessage({ type: 'error', text: result.message });
      return;
    }
    showMessage({ type: 'success', text: 'Surat jalan berhasil diperbarui.' });
    EDITING_ID = null;
    section.style.display = 'none';
    window.dispatchEvent(new CustomEvent('view-list-triggered'));
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Terjadi kesalahan: ' + err.message });
  }
}

// ============================================================
// EXPOSE TO WINDOW (for onclick handlers)
// ============================================================

(window as any)._sjEdit = {
  hapusBaris,
};
