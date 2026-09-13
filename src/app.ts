import './input.css';
import './client/styles.css';

import { renderLoadingScreen } from './client/components/LoadingScreen';
import { renderLoginScreen } from './client/components/LoginScreen';
import { renderNavbar, updateNavbarUserDisplay } from './client/components/Navbar';
import { renderSidebar, updateSidebarMenuState, type NavView } from './client/components/Sidebar';
import { renderDashboard } from './client/components/Dashboard';
import { renderListSuratJalan } from './client/components/ListSuratJalan';
import { renderCreateSuratJalan } from './client/components/CreateSuratJalan';
import { renderEditSuratJalan } from './client/components/EditSuratJalan';
import { renderAlamatManager, setupAlamatManagerEvents } from './client/components/AlamatManager';
import { renderPenerimaanBarang } from './client/components/PenerimaanBarang';
import { renderPenerimaanEksternal } from './client/components/PenerimaanEksternal';
import { renderKirimanPending } from './client/components/KirimanPending';
import { renderPengaturanAkun } from './client/components/PengaturanAkun';

import { AuthService } from './client/services/auth';
import { showMessage } from './client/utils/messaging';

// ============================================================
// VISIBILITY HELPERS (avoid Tailwind hidden/flex conflicts)
// ============================================================

function showElement(id: string, displayStyle = 'flex') {
  const el = document.getElementById(id);
  if (el) el.style.display = displayStyle;
}

function hideElement(id: string) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ============================================================
// APLIKASI MAIN INITIALIZATION
// ============================================================

function initializeApp() {
  const appDiv = document.getElementById('app') || document.body;
  
  // Create main container
  const mainContainer = document.createElement('div');
  mainContainer.className = 'min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col';
  
  // Create message box (toast notification)
  const msgBox = document.createElement('div');
  msgBox.id = 'msgBox';
  msgBox.className = 'hidden fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md';
  mainContainer.appendChild(msgBox);

  // 1. Loading Screen (visible on start)
  mainContainer.appendChild(renderLoadingScreen());

  // 2. Login Screen (hidden initially, shown after loading)
  mainContainer.appendChild(renderLoginScreen());

  // 3. App Screen (hidden initially, shown after login)
  const appScreen = document.createElement('div');
  appScreen.id = 'appScreen';
  appScreen.style.display = 'none';
  appScreen.className = 'flex flex-col flex-grow';

  // 3a. Navbar
  appScreen.appendChild(renderNavbar());

  // 3b. Sidebar + Content wrapper
  const layoutWrapper = document.createElement('div');
  layoutWrapper.className = 'flex flex-grow w-full overflow-hidden';

  layoutWrapper.appendChild(renderSidebar());

  const mainContent = document.createElement('main');
  mainContent.className = 'flex-grow p-6 space-y-6 min-w-0 overflow-y-auto';
  mainContent.id = 'contentArea';
  mainContent.appendChild(renderDashboard());
  mainContent.appendChild(renderListSuratJalan());
  mainContent.appendChild(renderCreateSuratJalan());
  mainContent.appendChild(renderEditSuratJalan());
  mainContent.appendChild(renderAlamatManager());
  mainContent.appendChild(renderPenerimaanBarang());
  mainContent.appendChild(renderPenerimaanEksternal());
  mainContent.appendChild(renderKirimanPending());
  mainContent.appendChild(renderPengaturanAkun());

  layoutWrapper.appendChild(mainContent);
  appScreen.appendChild(layoutWrapper);
  mainContainer.appendChild(appScreen);

  appDiv.appendChild(mainContainer);

  // Sidebar toggle state (persisted)
  const sidebarEl = document.getElementById('appSidebar');
  if (sidebarEl && localStorage.getItem('sidebarCollapsed') === '1') {
    if (window.innerWidth < 768) {
      sidebarEl.classList.add('hidden');
    } else {
      sidebarEl.classList.add('collapsed');
      const chevron = sidebarEl.querySelector('#sidebarToggleBtn i') as HTMLElement;
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
  }

  // Setup event listeners
  setupAppEvents();
  setupAlamatManagerEvents();

  // Auto-transition: Loading → Login (setelah 800ms)
  setTimeout(() => {
    hideElement('loadingScreen');
    showElement('loginScreen', 'flex');
  }, 800);
}

function setupAppEvents() {
  // Login success
  window.addEventListener('login-success', () => {
    hideElement('loadingScreen');
    hideElement('loginScreen');
    showElement('appScreen', 'flex');

    updateNavbarUserDisplay();

    // Re-render sidebar setelah login agar role-based menu (Penerimaan Eksternal) muncul
    const oldSidebar = document.getElementById('appSidebar');
    if (oldSidebar) {
      const newSidebar = renderSidebar();
      const wasCollapsed = oldSidebar.classList.contains('collapsed');
      oldSidebar.replaceWith(newSidebar);
      if (wasCollapsed) {
        newSidebar.classList.add('collapsed');
        const chevron = newSidebar.querySelector('#sidebarToggleBtn i') as HTMLElement;
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
    }

    updateSidebarMenuState('dashboard');

    // Trigger dashboard view load (user sudah login)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('view-dashboard-triggered'));
    }, 200);
  });

  // Logout
  window.addEventListener('logout', () => {
    hideElement('appScreen');
    showElement('loginScreen', 'flex');

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
      const usernameInput = loginScreen.querySelector('#loginUsername') as HTMLInputElement;
      const passwordInput = loginScreen.querySelector('#loginPassword') as HTMLInputElement;
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';
    }
  });

  // Sidebar toggle
  window.addEventListener('toggle-sidebar', () => {
    const sidebar = document.getElementById('appSidebar');
    if (!sidebar) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      sidebar.classList.toggle('hidden');
      // Reset collapsed state when toggling on mobile
      sidebar.classList.remove('collapsed');
    } else {
      sidebar.classList.toggle('collapsed');
    }
    const isCollapsed = isMobile ? sidebar.classList.contains('hidden') : sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
    // Rotate chevron icon
    const chevron = sidebar.querySelector('#sidebarToggleBtn i') as HTMLElement;
    if (chevron) {
      chevron.style.transform = isCollapsed ? 'rotate(180deg)' : '';
    }
  });

  // View navigation events
  window.addEventListener('view-dashboard-triggered', () => {
    navigateToSection('sectDashboard', 'dashboard');
    window.dispatchEvent(new CustomEvent('view-dashboard'));
  });

  window.addEventListener('view-list-triggered', () => {
    navigateToSection('sectListSuratJalan', 'list');
  });

  window.addEventListener('view-create-triggered', () => {
    navigateToSection('sectCreateSuratJalan', 'list');
    // Dispatch view-create so CreateSuratJalan reloads reference data
    window.dispatchEvent(new CustomEvent('view-create'));
    // Keep "Daftar Surat Jalan" active in sidebar (create is accessed from list)
  });

  window.addEventListener('view-alamat-triggered', () => {
    navigateToSection('sectAlamatManager', 'alamat');
  });

  window.addEventListener('view-penerimaan-triggered', () => {
    navigateToSection('sectPenerimaanBarang', 'penerimaan');
  });

  window.addEventListener('view-penerimaan-eksternal-triggered', () => {
    navigateToSection('sectPenerimaanEksternal', 'penerimaan-eksternal');
  });

  window.addEventListener('view-kiriman-pending-triggered', () => {
    navigateToSection('sectKirimanPending', 'kiriman-pending');
  });

  window.addEventListener('view-pengaturan-akun-triggered', () => {
    navigateToSection('sectPengaturanAkun', 'pengaturan-akun');
  });
}

// ============================================================
// SECTION VISIBILITY HELPERS
// ============================================================

const ALL_SECTIONS = ['sectDashboard', 'sectListSuratJalan', 'sectCreateSuratJalan', 'sectEditSuratJalan', 'sectAlamatManager', 'sectPenerimaanBarang', 'sectPenerimaanEksternal', 'sectKirimanPending', 'sectPengaturanAkun'];

function hideAllSections() {
  ALL_SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ============================================================
// NAVIGATION HISTORY (for Back button)
// ============================================================

const NAV_HISTORY: string[] = [];

function getCurrentSectionId(): string | null {
  for (const id of ALL_SECTIONS) {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none') return id;
  }
  return null;
}

function navigateToSection(sectionId: string, sidebarState?: string) {
  const current = getCurrentSectionId();
  if (current && current !== sectionId && NAV_HISTORY[NAV_HISTORY.length - 1] !== current) {
    NAV_HISTORY.push(current);
  }
  hideAllSections();
  showElement(sectionId, 'block');
  if (sidebarState) updateSidebarMenuState(sidebarState as NavView);
  updateBackButtons();
}

const SECTION_TO_SIDEBAR_STATE: Record<string, string> = {
  sectDashboard: 'dashboard',
  sectListSuratJalan: 'list',
  sectCreateSuratJalan: 'list',
  sectEditSuratJalan: 'list',
  sectAlamatManager: 'alamat',
  sectPenerimaanBarang: 'penerimaan',
  sectPenerimaanEksternal: 'penerimaan-eksternal',
  sectKirimanPending: 'kiriman-pending',
  sectPengaturanAkun: 'pengaturan-akun',
};

function updateBackButtons() {
  const hasHistory = NAV_HISTORY.length > 0;
  ALL_SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll<HTMLElement>('.sj-btn-back').forEach(btn => {
      btn.style.display = hasHistory ? '' : 'none';
    });
  });
}

function goBack() {
  const target = NAV_HISTORY.pop();
  if (!target || !ALL_SECTIONS.includes(target)) {
    navigateToSection('sectDashboard', 'dashboard');
    return;
  }
  hideAllSections();
  showElement(target, 'block');
  updateSidebarMenuState((SECTION_TO_SIDEBAR_STATE[target] || 'dashboard') as NavView);
  updateBackButtons();
}

(window as any)._nav = { back: goBack };

// Listen for section show requests (from EditSuratJalan etc.)
window.addEventListener('show-section', ((e: CustomEvent) => {
  navigateToSection(e.detail.sectionId);
}) as EventListener);

// Initialize app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
