import { AuthService } from '../services/auth';

export function renderNavbar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.id = 'appNavbar';
  nav.className = 'bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm';
  
  nav.innerHTML = `
    <div class="flex items-center gap-3">
      <button id="navToggleSidebar" class="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Toggle sidebar">
        <i class="bi bi-list text-lg"></i>
      </button>
      <div class="flex items-center gap-2">
        <span class="text-xl">📦</span>
        <div class="flex flex-col">
          <span class="text-sm font-bold text-slate-900">Surat Jalan</span>
          <span class="text-xs text-slate-500">Sistem Pengiriman</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="hidden md:flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-600">
          <span id="userDisplayName">Staff Gudang</span>
          <span class="mx-1 text-slate-400">•</span>
          <span id="userDisplayCabang" class="text-blue-600">JKT</span>
        </span>
      </div>
      <button id="btnLogout" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors">
        Keluar
      </button>
    </div>
  `;

  setupNavbarEvents(nav);
  updateNavbarUser();
  
  return nav;
}

function setupNavbarEvents(nav: HTMLElement) {
  const toggleBtn = nav.querySelector('#navToggleSidebar') as HTMLButtonElement;
  const logoutBtn = nav.querySelector('#btnLogout') as HTMLButtonElement;

  toggleBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  });

  logoutBtn.addEventListener('click', () => {
    AuthService.logout();
    window.dispatchEvent(new CustomEvent('logout'));
  });
}

function updateNavbarUser() {
  const user = AuthService.getCurrentUser();
  const nameEl = document.getElementById('userDisplayName');
  const cabangEl = document.getElementById('userDisplayCabang');
  
  if (nameEl && user) nameEl.textContent = user.nama;
  if (cabangEl && user) cabangEl.textContent = user.cabang + (user.role === 'admin' ? ' (Pusat)' : '');
}

export function updateNavbarUserDisplay() {
  updateNavbarUser();
}
