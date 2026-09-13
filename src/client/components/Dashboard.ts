import { AuthService } from '../services/auth';

// ============================================================
// RENDER
// ============================================================

export function renderDashboard(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectDashboard';
  section.className = 'space-y-6';

  section.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
        <h2 class="text-lg font-bold text-slate-900"><i class="bi bi-house-door me-1 text-blue-600"></i> Beranda</h2>
      </div>
    </div>

    <div class="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl shadow-xl text-white p-6 md:p-8">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div class="text-xs uppercase tracking-widest text-blue-200 font-semibold mb-2">Sistem Surat Jalan</div>
          <h1 class="text-2xl md:text-3xl font-bold mb-2">Selamat Datang, <span id="dashNama">Pengguna</span> 👋</h1>
          <p class="text-blue-100 text-sm md:text-base">Terima kasih sudah masuk. Pilih menu di bawah untuk mulai bekerja.</p>
        </div>
        <div class="shrink-0 bg-white/10 rounded-xl px-4 py-3 text-sm border border-white/20">
          <div class="text-blue-200 text-xs font-semibold mb-1">AKUN AKTIF</div>
          <div id="dashIdentitas" class="font-semibold">-</div>
          <div id="dashCabang" class="text-blue-100 text-xs mt-0.5">-</div>
        </div>
      </div>
    </div>

    <div>
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Menu Cepat</div>
      <div id="dashCards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button class="dash-card" data-target="list" data-icon="📄" data-title="Daftar Surat Jalan" data-desc="Lihat dan kelola semua surat jalan."></button>
        <button class="dash-card" data-target="penerimaan" data-icon="📦" data-title="Penerimaan Barang" data-desc="Terima barang yang ditujukan ke cabang Anda."></button>
        <button class="dash-card" data-target="penerimaan-eksternal" data-icon="📥" data-title="Penerimaan Eksternal" data-desc="Input penerimaan barang dari sumber eksternal."></button>
        <button class="dash-card" data-target="alamat" data-icon="📍" data-title="Kelola Alamat" data-desc="Kelola data alamat, PIC, dan kontak cabang."></button>
        <button class="dash-card" data-target="pengaturan-akun" data-icon="👤" data-title="Pengaturan Akun" data-desc="Ubah password login untuk keamanan akun Anda."></button>
      </div>
    </div>
  `;

  setupDashboardEvents(section);
  return section;
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupDashboardEvents(section: HTMLElement) {
  const namaEl = section.querySelector('#dashNama');
  const identitasEl = section.querySelector('#dashIdentitas');
  const cabangEl = section.querySelector('#dashCabang');
  const user = AuthService.getCurrentUser();

  if (user && namaEl) namaEl.textContent = user.nama;
  if (user && identitasEl) identitasEl.textContent = user.role === 'admin' ? 'Admin Pusat' : user.nama;
  if (user && cabangEl) cabangEl.textContent = user.cabang + (user.role === 'admin' ? ' (Pusat)' : '');

  section.querySelectorAll<HTMLElement>('.dash-card').forEach(card => {
    card.innerHTML = `
      <span class="text-2xl">${card.dataset.icon}</span>
      <div class="text-left">
        <div class="font-semibold text-slate-900">${card.dataset.title}</div>
        <div class="text-xs text-slate-500 leading-snug mt-0.5">${card.dataset.desc}</div>
      </div>
      <i class="bi bi-chevron-right text-slate-300 ml-auto"></i>
    `;

    card.addEventListener('click', () => navigateFromDashboard(card.dataset.target || 'list'));
  });

  window.addEventListener('view-dashboard', () => {
    const u = AuthService.getCurrentUser();
    if (u && namaEl) namaEl.textContent = u.nama;
    if (u && identitasEl) identitasEl.textContent = u.role === 'admin' ? 'Admin Pusat' : u.nama;
    if (u && cabangEl) cabangEl.textContent = u.cabang + (u.role === 'admin' ? ' (Pusat)' : '');
  });
}

function navigateFromDashboard(target: string) {
  const triggeredMap: Record<string, string> = {
    list: 'view-list-triggered',
    penerimaan: 'view-penerimaan-triggered',
    'penerimaan-eksternal': 'view-penerimaan-eksternal-triggered',
    alamat: 'view-alamat-triggered',
    'pengaturan-akun': 'view-pengaturan-akun-triggered',
  };
  const dataMap: Record<string, string> = {
    list: 'view-list',
    penerimaan: 'view-penerimaan',
    'penerimaan-eksternal': 'view-penerimaan-eksternal',
    alamat: 'view-alamat',
    'pengaturan-akun': 'view-pengaturan-akun',
  };
  window.dispatchEvent(new CustomEvent(triggeredMap[target] || 'view-list-triggered'));
  window.dispatchEvent(new CustomEvent(dataMap[target] || 'view-list'));
}