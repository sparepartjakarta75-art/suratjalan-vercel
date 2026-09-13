import { DataService } from '../services/data';
import { AuthService } from '../services/auth';
import { Api } from '../utils/api-client';
import { showMessage } from '../utils/messaging';
import type { JenisBarang, Alamat } from '../types';

let detailRowCount = 0;

export function renderCreateSuratJalan(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectCreateSuratJalan';
  section.style.display = 'none';
  section.className = 'bg-white border border-slate-200 rounded-2xl shadow-sm';
  
  section.innerHTML = `
    <div class="p-6 border-b border-slate-100">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-bold text-slate-900">Formulir Pengiriman Baru</h2>
        <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
      </div>
      <p class="text-sm text-slate-500 mt-1">Input detail data kendaraan dan spare part di bawah ini</p>
    </div>

    <form id="formInputSuratJalan" class="p-6 space-y-6">
      <!-- Bagian 1: Konfigurasi Pengiriman -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-slate-900">Konfigurasi Pengiriman</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Transit</label>
            <select id="cPerluDiteruskan" class="sj-select">
              <option value="Tidak">Tidak</option>
              <option value="Ya">Ya</option>
            </select>
          </div>
          <div id="wrapTujuanAkhirCreate" class="hidden">
            <label class="block text-sm font-semibold text-slate-700 mb-1">Tujuan Akhir</label>
            <select id="cTujuanAkhir" class="sj-select">
              <option value="">-- Pilih tujuan akhir --</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Bagian 2: Info Pengiriman -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-slate-900">Info Pengiriman</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Asal</label>
            <input type="text" id="cCabangAsal" class="sj-input sj-input-readonly" disabled />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Tujuan</label>
            <select id="cCabangTujuan" class="sj-select"></select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Kode Jenis Barang</label>
            <select id="cJenisBarang" class="sj-select"></select>
          </div>
        </div>
        <!-- Pengirim (Dari) Info -->
        <div id="pengirimInfoCreate" class="hidden bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <i class="bi bi-person-fill text-green-600"></i>
            <span class="font-semibold text-green-800">Pengirim (Dari)</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span class="text-green-700 font-medium">Nama:</span>
              <span id="pengirimNamaCreate" class="ml-2 text-slate-900"></span>
            </div>
            <div>
              <span class="text-green-700 font-medium">Dept:</span>
              <span id="pengirimDeptCreate" class="ml-2 text-slate-900"></span>
            </div>
            <div>
              <span class="text-green-700 font-medium">Telp:</span>
              <span id="pengirimTlpCreate" class="ml-2 text-slate-900"></span>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">Dikirim Via <span class="text-slate-400 font-normal">(opsional)</span></label>
          <input type="text" id="cDikirimVia" class="sj-input" placeholder="cth: Bp. Sujarwo → Bp. Maryono" />
        </div>
      </div>

      <!-- Barang dari Penerimaan Eksternal (Open) -->
      <div id="wrapOpenEksternalCreate" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div class="flex items-center gap-2">
          <i class="bi bi-box-seam text-blue-600"></i>
          <span class="font-semibold text-blue-800">Barang dari Penerimaan Eksternal (Open)</span>
        </div>
        <p class="text-sm text-blue-700">Item berikut terbuka (Open) untuk tujuan ini dan otomatis ditambahkan ke detail di bawah.</p>
        <div id="openEksternalListCreate" class="text-sm"></div>
      </div>

      <!-- Bagian 3: Detail Barang -->
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
                <th class="p-3 text-left font-semibold text-slate-700">Keterangan</th>
                <th class="p-3 text-center font-semibold text-slate-700 w-10"></th>
              </tr>
            </thead>
            <tbody id="detailRowsCreate"></tbody>
          </table>
        </div>
        <button type="button" id="btnAddDetailRow" class="sj-btn-view inline-flex items-center gap-1 px-4 py-2 font-medium rounded-lg text-sm transition-colors">
          <i class="bi bi-plus-circle"></i>Tambah Baris
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button type="button" id="btnCancelCreate" class="sj-btn-cancel inline-flex items-center gap-1 px-4 py-2 font-medium rounded-lg text-sm transition-colors">
          <i class="bi bi-x-circle"></i>Batal
        </button>
        <button type="submit" class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm">
          <i class="bi bi-check2-circle"></i>Simpan & Buat Nomor Surat Jalan
        </button>
      </div>
    </form>
  `;

  setupCreateEvents(section);
  return section;
}

function setupCreateEvents(section: HTMLElement) {
  const form = section.querySelector('#formInputSuratJalan') as HTMLFormElement;
  const perluDiteruskanSelect = section.querySelector('#cPerluDiteruskan') as HTMLSelectElement;
  const addRowBtn = section.querySelector('#btnAddDetailRow') as HTMLButtonElement;
  const cancelBtn = section.querySelector('#btnCancelCreate') as HTMLButtonElement;

  // Load referensi data
  loadReferensiData(section);

  // Toggle tujuan akhir
  perluDiteruskanSelect.addEventListener('change', () => {
    const wrap = section.querySelector('#wrapTujuanAkhirCreate') as HTMLElement;
    const cabangTujuanSel = section.querySelector('#cCabangTujuan') as HTMLSelectElement;
    if (perluDiteruskanSelect.value === 'Ya') {
      // Pastikan opsi JKT ada di dropdown (meskipun user berada di JKT)
      if (!Array.from(cabangTujuanSel.options).some(o => o.value === 'JKT')) {
        const opt = document.createElement('option');
        opt.value = 'JKT';
        opt.textContent = 'JKT';
        cabangTujuanSel.insertBefore(opt, cabangTujuanSel.firstChild);
      }
      cabangTujuanSel.value = 'JKT';
      cabangTujuanSel.disabled = true;
      wrap.classList.remove('hidden');
      loadTujuanAkhirOptionsCreate(section);
    } else {
      // Hapus opsi JKT jika user adalah JKT (agar tidak ada di daftar biasa)
      const user = AuthService.getCurrentUser();
      if (user && user.cabang === 'JKT') {
        const jktOpt = Array.from(cabangTujuanSel.options).find(o => o.value === 'JKT');
        if (jktOpt) jktOpt.remove();
      }
      cabangTujuanSel.disabled = false;
      wrap.classList.add('hidden');
    }
  });

  addRowBtn.addEventListener('click', (e) => {
    e.preventDefault();
    tambahBarisDetail(section);
  });

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('view-list-triggered'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitForm(section);
  });

  // Listen untuk view-create event
  window.addEventListener('view-create', () => {
    loadReferensiData(section);
    resetForm(section);
  });

  // Auto-load item penerimaan eksternal (Open) saat tujuan dipilih
  const cabangTujuanSel = section.querySelector('#cCabangTujuan') as HTMLSelectElement;
  cabangTujuanSel.addEventListener('change', async () => {
    await autoLoadOpenEksternal(section, cabangTujuanSel.value);
  });
}

async function autoLoadOpenEksternal(section: HTMLElement, tujuan: string) {
  const wrap = section.querySelector('#wrapOpenEksternalCreate') as HTMLElement;
  const listWrap = section.querySelector('#openEksternalListCreate') as HTMLElement;
  if (!tujuan) {
    wrap.classList.add('hidden');
    return;
  }
  listWrap.innerHTML = '<div class="flex items-center gap-2 text-blue-600"><div class="loading loading-spinner loading-xs"></div> Memuat...</div>';
  wrap.classList.remove('hidden');
  try {
    const items = await DataService.loadOpenPenerimaanEksternalUntukTujuan(tujuan);
    const tbody = section.querySelector('#detailRowsCreate') as HTMLTableSectionElement;
    // Bersihkan baris detail yang berasal dari eksternal untuk tujuan ini agar tidak dobel
    tbody.querySelectorAll('tr[data-extdetailid]').forEach((tr) => tr.remove());
    const allRows = Array.from(tbody.children) as HTMLTableRowElement[];
    if (items.length === 0) {
      listWrap.innerHTML = '<span class="text-blue-500">Tidak ada item eksternal Open untuk tujuan ini.</span>';
    } else {
      listWrap.innerHTML = `<span class="text-blue-800 font-semibold">${items.length} item Open akan dikirim ke ${tujuan}</span>`;
      items.forEach((item: any) => {
        tambahBarisDetail(section, {
          noBukti: item.noBukti,
          deskripsi: item.deskripsi,
          qty: String(item.qty),
          satuan: item.satuan,
          keterangan: item.keterangan,
          extDetailId: item.idDetail
        });
      });
    }
    // Renomori baris
    renomoriBarisCreate(tbody);
  } catch (err: any) {
    listWrap.innerHTML = '<span class="text-red-500">Gagal memuat item eksternal: ' + (err.message || err) + '</span>';
  }
}

function renomoriBarisCreate(tbody: HTMLTableSectionElement) {
  tbody.querySelectorAll('tr').forEach((tr, i) => {
    (tr.querySelector('td:first-child') as HTMLTableCellElement).textContent = String(i + 1);
  });
}

async function loadReferensiData(section: HTMLElement) {
  const user = AuthService.getCurrentUser();
  if (!user) return;

  try {
    const [jenisBarang, alamat, alamatFull] = await Promise.all([
      DataService.loadJenisBarangList(),
      DataService.loadAlamatList(),
      Api.getAlamatFullList()
    ]);

    // Set cabang asal
    const cabangAsalInput = section.querySelector('#cCabangAsal') as HTMLInputElement;
    cabangAsalInput.value = user.cabang;

    // Populate pengirim info from ALAMAT sheet based on asal
    const alamatAsal = alamatFull.find((a: any) => a.site === user.cabang);
    if (alamatAsal) {
      const pengirimInfo = section.querySelector('#pengirimInfoCreate') as HTMLElement;
      const pengirimNama = section.querySelector('#pengirimNamaCreate') as HTMLElement;
      const pengirimDept = section.querySelector('#pengirimDeptCreate') as HTMLElement;
      const pengirimTlp = section.querySelector('#pengirimTlpCreate') as HTMLElement;
      
      pengirimNama.textContent = alamatAsal.pengirim || '-';
      pengirimDept.textContent = alamatAsal.dept || '-';
      pengirimTlp.textContent = alamatAsal.tlp || '-';
      pengirimInfo.classList.remove('hidden');

      // Auto-fill Dikirim Via with pengirim name
      const dikirimViaInput = section.querySelector('#cDikirimVia') as HTMLInputElement;
      if (dikirimViaInput && alamatAsal.pengirim) {
        dikirimViaInput.value = alamatAsal.pengirim;
      }
    }

    // Populate tujuan dari ALAMAT (site codes)
    const cabangTujuanSel = section.querySelector('#cCabangTujuan') as HTMLSelectElement;
    cabangTujuanSel.innerHTML = '';
    alamat.forEach((a: Alamat) => {
      if (a.site !== user.cabang) {
        const opt = document.createElement('option');
        opt.value = a.site;
        opt.textContent = a.site + (a.wilayah ? ` - ${a.wilayah}` : '');
        cabangTujuanSel.appendChild(opt);
      }
    });

    // Populate jenis barang
    const jenisBarangSel = section.querySelector('#cJenisBarang') as HTMLSelectElement;
    jenisBarangSel.innerHTML = '';
    jenisBarang.forEach((j: JenisBarang) => {
      const opt = document.createElement('option');
      opt.value = j.Kode;
      opt.textContent = `${j.Kode} - ${j['Nama Jenis']}`;
      jenisBarangSel.appendChild(opt);
    });

    // Populate tujuan akhir
    const tujuanAkhirSel = section.querySelector('#cTujuanAkhir') as HTMLSelectElement;
    tujuanAkhirSel.innerHTML = '<option value="">-- Pilih tujuan akhir --</option>';
    alamat.forEach((a: Alamat) => {
      const opt = document.createElement('option');
      opt.value = a.site;
      opt.textContent = a.site + (a.wilayah ? ` - ${a.wilayah}` : '');
      tujuanAkhirSel.appendChild(opt);
    });
  } catch (error) {
    showMessage({
      type: 'error',
      text: 'Gagal memuat data referensi'
    });
  }
}

async function loadTujuanAkhirOptionsCreate(section: HTMLElement) {
  const sel = section.querySelector('#cTujuanAkhir') as HTMLSelectElement;
  try {
    const alamatList = await DataService.loadAlamatList();
    sel.innerHTML = '<option value="">-- Pilih tujuan akhir --</option>';
    alamatList.forEach((a: any) => {
      const opt = document.createElement('option');
      opt.value = a.site || '';
      opt.textContent = a.site + (a.wilayah ? ` - ${a.wilayah}` : '');
      sel.appendChild(opt);
    });
  } catch (err: any) {
    showMessage({ type: 'error', text: 'Gagal memuat tujuan akhir: ' + err.message });
  }
}

function resetForm(section: HTMLElement) {
  const form = section.querySelector('#formInputSuratJalan') as HTMLFormElement;
  form.reset();
  
  const user = AuthService.getCurrentUser();
  const cabangAsalInput = section.querySelector('#cCabangAsal') as HTMLInputElement;
  if (user) cabangAsalInput.value = user.cabang;

  // Re-auto-fill pengirim info and dikirimVia after reset
  loadReferensiData(section).then(() => {
    // Reset detail rows after data loads
    const detailRows = section.querySelector('#detailRowsCreate') as HTMLTableSectionElement;
    detailRows.innerHTML = '';
    detailRowCount = 0;
    tambahBarisDetail(section);
  });

  // Reset transit
  const perluSel = section.querySelector('#cPerluDiteruskan') as HTMLSelectElement;
  perluSel.value = 'Tidak';
  const wrapTujuan = section.querySelector('#wrapTujuanAkhirCreate') as HTMLElement;
  wrapTujuan.classList.add('hidden');
  const cabangTujuanSel = section.querySelector('#cCabangTujuan') as HTMLSelectElement;
  cabangTujuanSel.disabled = false;

  // Sembunyikan panel item eksternal Open
  const wrapOpen = section.querySelector('#wrapOpenEksternalCreate') as HTMLElement;
  if (wrapOpen) wrapOpen.classList.add('hidden');
}

function tambahBarisDetail(section: HTMLElement, opts?: { noBukti?: string; deskripsi?: string; qty?: string; satuan?: string; keterangan?: string; extDetailId?: string }) {
  detailRowCount++;
  const rowId = `crow_${detailRowCount}`;
  const tbody = section.querySelector('#detailRowsCreate') as HTMLTableSectionElement;
  
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.className = 'border-b border-slate-200 hover:bg-slate-50';
  if (opts?.extDetailId) tr.dataset.extDetailId = opts.extDetailId;
  tr.innerHTML = `
    <td class="p-3 text-center font-semibold text-slate-500">${tbody.children.length + 1}</td>
    <td class="p-3"><input type="text" class="sj-input sj-input-sm d-nobukti" placeholder="cth: KAP/TGR/SV/26/04/001" value="${opts?.noBukti ?? ''}" /></td>
    <td class="p-3"><input type="text" class="sj-input sj-input-sm d-deskripsi" placeholder="cth: SPAREPART HA NON MKS" value="${opts?.deskripsi ?? ''}" /></td>
    <td class="p-3 text-center"><input type="number" min="1" class="sj-input sj-input-sm d-qty" placeholder="1" value="${opts?.qty ?? ''}" /></td>
    <td class="p-3"><select class="sj-select sj-select-sm d-satuan"><option value="">--</option><option value="EA">EA</option><option value="COLLY">COLLY</option><option value="BOX">BOX</option><option value="SET">SET</option><option value="PCS">PCS</option><option value="KG">KG</option><option value="ROLL">ROLL</option><option value="PACK">PACK</option><option value="UNIT">UNIT</option></select></td>
    <td class="p-3"><input type="text" class="sj-input sj-input-sm d-keterangan" placeholder="opsional" value="${opts?.keterangan ?? ''}" /></td>
    <td class="p-3 text-center"><button type="button" class="sj-btn-icon sj-btn-delete text-xs" onclick="document.getElementById('${rowId}')?.remove()"><i class="bi bi-x-lg"></i></button></td>
  `;
  if (opts?.satuan) {
    const satuanSel = tr.querySelector('.d-satuan') as HTMLSelectElement;
    satuanSel.value = opts.satuan;
  }
  tbody.appendChild(tr);
  return tr;
}

async function submitForm(section: HTMLElement) {
  const user = AuthService.getCurrentUser();
  if (!user) return;

  const form = section.querySelector('#formInputSuratJalan') as HTMLFormElement;
  const cabangAsal = (section.querySelector('#cCabangAsal') as HTMLInputElement).value;
  const cabangTujuan = (section.querySelector('#cCabangTujuan') as HTMLSelectElement).value;
  const kodeJenis = (section.querySelector('#cJenisBarang') as HTMLSelectElement).value;
  const dikirimVia = (section.querySelector('#cDikirimVia') as HTMLInputElement).value;
  const perluDiteruskan = (section.querySelector('#cPerluDiteruskan') as HTMLSelectElement).value;
  const tujuanAkhir = (section.querySelector('#cTujuanAkhir') as HTMLSelectElement).value;

  // Collect detail items
  const details: any[] = [];
  const externalItems: any[] = [];
  const rows = section.querySelectorAll('#detailRowsCreate tr');
  rows.forEach((tr: Element) => {
    const row = tr as HTMLTableRowElement;
    const noBukti = (row.querySelector('.d-nobukti') as HTMLInputElement).value.trim();
    const deskripsi = (row.querySelector('.d-deskripsi') as HTMLInputElement).value.trim();
    const qty = (row.querySelector('.d-qty') as HTMLInputElement).value;
    const satuan = (row.querySelector('.d-satuan') as HTMLSelectElement).value.trim();
    const keterangan = (row.querySelector('.d-keterangan') as HTMLInputElement).value.trim();
    const extDetailId = (row as HTMLElement).dataset.extDetailId;

    if (deskripsi && qty) {
      details.push({ noBukti, deskripsi, qty: parseInt(qty), satuan, keterangan });
      if (extDetailId) {
        externalItems.push({ idDetail: extDetailId, tujuanSite: cabangTujuan });
      }
    }
  });

  if (!cabangTujuan) {
    showMessage({ type: 'error', text: 'Tujuan wajib dipilih' });
    return;
  }

  if (!kodeJenis) {
    showMessage({ type: 'error', text: 'Kode jenis barang wajib dipilih' });
    return;
  }

  if (details.length === 0) {
    showMessage({ type: 'error', text: 'Minimal 1 baris detail barang harus diisi' });
    return;
  }

  if (perluDiteruskan === 'Ya' && !tujuanAkhir) {
    showMessage({ type: 'error', text: 'Tujuan akhir wajib diisi jika transit aktif' });
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const origText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Memproses...';

  try {
    const result = await DataService.saveSuratJalan({
      cabangAsal,
      cabangTujuan,
      kodeJenis,
      dikirimVia,
      username: user.username,
      perluDiteruskan,
      tujuanAkhir,
      details,
      externalItems
    });

    showMessage({
      type: 'success',
      text: `Surat jalan berhasil dibuat: ${result.noSuratJalan}`
    });

    resetForm(section);
    DataService.invalidateDaftarCache();
    window.dispatchEvent(new CustomEvent('view-list-triggered'));
  } catch (error) {
    showMessage({
      type: 'error',
      text: error instanceof Error ? error.message : 'Gagal menyimpan surat jalan'
    });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
  }
}
