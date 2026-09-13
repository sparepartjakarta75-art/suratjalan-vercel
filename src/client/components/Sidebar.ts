import { AuthService } from '../services/auth';

const ACTIVE_BTN = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors text-left';
const INACTIVE_BTN = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left';

export type NavView = 'dashboard' | 'list' | 'alamat' | 'penerimaan' | 'penerimaan-eksternal' | 'kiriman-pending' | 'pengaturan-akun';

export function renderSidebar(): HTMLElement {
  const aside = document.createElement('aside');
  aside.id = 'appSidebar';
  aside.className = 'w-64 bg-white border-r border-slate-200 p-4 hidden md:flex flex-col space-y-2 h-screen sticky top-16 overflow-y-auto';

  const user = AuthService.getCurrentUser();

  aside.innerHTML = `
    <div class="flex items-center justify-between px-2 pb-4 mb-2 border-b border-slate-200">
      <span class="sidebar-label text-xs font-bold text-slate-500 uppercase tracking-wide">Menu Utama</span>
      <button id="sidebarToggleBtn" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Sembunyikan sidebar">
        <i class="bi bi-chevron-left text-sm transition-transform duration-300"></i>
      </button>
    </div>

    <button id="navMenuDashboard" class="${INACTIVE_BTN}">
      <span class="text-lg">🏠</span>
      <span>Beranda</span>
    </button>

    <button id="navMenuList" class="${ACTIVE_BTN}">
      <span class="text-lg">📄</span>
      <span>Daftar Surat Jalan</span>
    </button>

    <button id="navMenuPenerimaan" class="${INACTIVE_BTN}">
      <span class="text-lg">📦</span>
      <span>Penerimaan Barang</span>
    </button>

    <button id="navMenuPenerimaanEksternal" class="${INACTIVE_BTN}">
      <span class="text-lg">📥</span>
      <span>Penerimaan Eksternal</span>
    </button>

    <button id="navMenuKirimanPending" class="${INACTIVE_BTN}">
      <span class="text-lg">📤</span>
      <span>Kiriman Pending</span>
    </button>

    <button id="navMenuAlamat" class="${INACTIVE_BTN}">
      <span class="text-lg">📍</span>
      <span>Kelola Alamat</span>
    </button>

    <button id="navMenuPengaturanAkun" class="${INACTIVE_BTN}">
      <span class="text-lg">👤</span>
      <span>Pengaturan Akun</span>
    </button>

    <div class="sidebar-info pt-4 mt-4 border-t border-slate-200">
      <div class="px-2 py-2 text-xs text-slate-500 font-semibold">Info</div>
      <div class="px-4 py-2 bg-slate-50 rounded-lg text-xs text-slate-600">
        <div class="mb-2">
          <span class="font-semibold">Versi:</span> 2.0.0
        </div>
        <div class="text-slate-500">
          Sistem manajemen surat jalan terpadu
        </div>
      </div>
    </div>
  `;

  setupSidebarEvents(aside);
  return aside;
}

function setupSidebarEvents(sidebar: HTMLElement) {
  const dashboardBtn = sidebar.querySelector('#navMenuDashboard') as HTMLButtonElement;
  const listBtn = sidebar.querySelector('#navMenuList') as HTMLButtonElement;
  const penerimaanBtn = sidebar.querySelector('#navMenuPenerimaan') as HTMLButtonElement;
  const penerimaanEksternalBtn = sidebar.querySelector('#navMenuPenerimaanEksternal') as HTMLButtonElement;
  const kirimanPendingBtn = sidebar.querySelector('#navMenuKirimanPending') as HTMLButtonElement;
  const alamatBtn = sidebar.querySelector('#navMenuAlamat') as HTMLButtonElement;
  const pengaturanBtn = sidebar.querySelector('#navMenuPengaturanAkun') as HTMLButtonElement;
  const toggleBtn = sidebar.querySelector('#sidebarToggleBtn') as HTMLButtonElement;

  dashboardBtn.addEventListener('click', () => switchView('dashboard'));
  listBtn.addEventListener('click', () => switchView('list'));
  penerimaanBtn.addEventListener('click', () => switchView('penerimaan'));
  penerimaanEksternalBtn.addEventListener('click', () => switchView('penerimaan-eksternal'));
  kirimanPendingBtn.addEventListener('click', () => switchView('kiriman-pending'));
  alamatBtn.addEventListener('click', () => switchView('alamat'));
  pengaturanBtn.addEventListener('click', () => switchView('pengaturan-akun'));
  toggleBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  });
}

function setActiveButton(view: NavView) {
  const dashboardBtn = document.querySelector('#navMenuDashboard') as HTMLButtonElement;
  const listBtn = document.querySelector('#navMenuList') as HTMLButtonElement;
  const penerimaanBtn = document.querySelector('#navMenuPenerimaan') as HTMLButtonElement;
  const penerimaanEksternalBtn = document.querySelector('#navMenuPenerimaanEksternal') as HTMLButtonElement;
  const kirimanPendingBtn = document.querySelector('#navMenuKirimanPending') as HTMLButtonElement;
  const alamatBtn = document.querySelector('#navMenuAlamat') as HTMLButtonElement;
  const pengaturanBtn = document.querySelector('#navMenuPengaturanAkun') as HTMLButtonElement;

  dashboardBtn.className = view === 'dashboard' ? ACTIVE_BTN : INACTIVE_BTN;
  listBtn.className = view === 'list' ? ACTIVE_BTN : INACTIVE_BTN;
  penerimaanBtn.className = view === 'penerimaan' ? ACTIVE_BTN : INACTIVE_BTN;
  penerimaanEksternalBtn.className = view === 'penerimaan-eksternal' ? ACTIVE_BTN : INACTIVE_BTN;
  kirimanPendingBtn.className = view === 'kiriman-pending' ? ACTIVE_BTN : INACTIVE_BTN;
  alamatBtn.className = view === 'alamat' ? ACTIVE_BTN : INACTIVE_BTN;
  pengaturanBtn.className = view === 'pengaturan-akun' ? ACTIVE_BTN : INACTIVE_BTN;
}

function switchView(view: NavView) {
  setActiveButton(view);

  // Dispatch events for section visibility (handled by app.ts)
  if (view === 'dashboard') {
    window.dispatchEvent(new CustomEvent('view-dashboard-triggered'));
    window.dispatchEvent(new CustomEvent('view-dashboard'));
  } else if (view === 'list') {
    window.dispatchEvent(new CustomEvent('view-list-triggered'));
    window.dispatchEvent(new CustomEvent('view-list'));
  } else if (view === 'penerimaan') {
    window.dispatchEvent(new CustomEvent('view-penerimaan-triggered'));
    window.dispatchEvent(new CustomEvent('view-penerimaan'));
  } else if (view === 'penerimaan-eksternal') {
    window.dispatchEvent(new CustomEvent('view-penerimaan-eksternal-triggered'));
    window.dispatchEvent(new CustomEvent('view-penerimaan-eksternal'));
  } else if (view === 'kiriman-pending') {
    window.dispatchEvent(new CustomEvent('view-kiriman-pending-triggered'));
    window.dispatchEvent(new CustomEvent('view-kiriman-pending'));
  } else if (view === 'pengaturan-akun') {
    window.dispatchEvent(new CustomEvent('view-pengaturan-akun-triggered'));
    window.dispatchEvent(new CustomEvent('view-pengaturan-akun'));
  } else {
    window.dispatchEvent(new CustomEvent('view-alamat-triggered'));
    window.dispatchEvent(new CustomEvent('view-alamat'));
  }

  // Close sidebar on mobile after navigation
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      window.dispatchEvent(new CustomEvent('toggle-sidebar'));
    }
  }
}

export function updateSidebarMenuState(view: NavView) {
  setActiveButton(view);
}
