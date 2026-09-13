import { Api } from '../utils/api-client';
import { showMessage } from '../utils/messaging';
import { AuthService } from '../services/auth';

// ============================================================
// RENDER
// ============================================================

export function renderPengaturanAkun(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'sectPengaturanAkun';
  section.style.display = 'none';

  section.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <button type="button" class="sj-btn-back" onclick="window._nav.back()" style="display:none;"><i class="bi bi-arrow-left"></i><span>Kembali</span></button>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <i class="bi bi-gear-fill text-blue-600"></i>
          Pengaturan Akun
        </h2>
      </div>
    </div>

    <!-- Info Akun -->
    <div class="bg-white rounded-xl border border-slate-200 p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0" id="akunAvatar">-</div>
      <div class="flex-grow">
        <div id="akunNama" class="text-base font-bold text-slate-800">-</div>
        <div id="akunDetail" class="text-sm text-slate-500">-</div>
      </div>
      <div class="text-xs text-slate-400 font-medium">Sistem Surat Jalan</div>
    </div>

    <!-- Form Ubah Password -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden max-w-xl">
      <div class="px-5 py-4 border-b border-slate-100">
        <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
          <i class="bi bi-key-fill text-slate-400"></i>
          Ubah Password Login
        </h3>
      </div>
      <form id="akunPassForm" class="px-5 py-4 space-y-4" autocomplete="off">
        <div>
          <label for="akunPassLama" class="block text-xs font-semibold text-slate-600 mb-1">Password Lama *</label>
          <input type="password" id="akunPassLama" class="sj-input" placeholder="Password yang sedang dipakai" required />
        </div>
        <div>
          <label for="akunPassBaru" class="block text-xs font-semibold text-slate-600 mb-1">Password Baru *</label>
          <input type="password" id="akunPassBaru" class="sj-input" placeholder="Minimal 4 karakter" required minlength="4" />
        </div>
        <div>
          <label for="akunPassKonfirmasi" class="block text-xs font-semibold text-slate-600 mb-1">Konfirmasi Password Baru *</label>
          <input type="password" id="akunPassKonfirmasi" class="sj-input" placeholder="Ulangi password baru" required minlength="4" />
        </div>
        <button type="submit" id="btnSimpanPass" class="sj-btn-primary inline-flex items-center gap-2">
          <i class="bi bi-check-circle"></i>
          <span>Simpan Perubahan</span>
        </button>
      </form>
    </div>
  `;

  setupPengaturanAkunEvents(section);
  return section;
}

// ============================================================
// EVENT SETUP
// ============================================================

function setupPengaturanAkunEvents(section: HTMLElement) {
  refreshAccountInfo(section);

  window.addEventListener('view-pengaturan-akun', () => {
    refreshAccountInfo(section);
  });

  const form = section.querySelector('#akunPassForm') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = AuthService.getCurrentUser();
    if (!user) {
      showMessage({ type: 'error', text: 'Sesi tidak ditemukan. Silakan login kembali.' });
      return;
    }

    const passLama = (section.querySelector('#akunPassLama') as HTMLInputElement).value.trim();
    const passBaru = (section.querySelector('#akunPassBaru') as HTMLInputElement).value.trim();
    const passKonfirmasi = (section.querySelector('#akunPassKonfirmasi') as HTMLInputElement).value.trim();

    if (!passLama || !passBaru) {
      showMessage({ type: 'error', text: 'Password lama dan password baru wajib diisi.' });
      return;
    }
    if (passBaru.length < 4) {
      showMessage({ type: 'error', text: 'Password baru minimal 4 karakter.' });
      return;
    }
    if (passBaru !== passKonfirmasi) {
      showMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }

    const btn = section.querySelector('#btnSimpanPass') as HTMLButtonElement;
    if (btn) btn.disabled = true;

    try {
      const result = await Api.gantiPassword({ username: user.username, passwordLama: passLama, passwordBaru: passBaru });
      if (!result.success) {
        showMessage({ type: 'error', text: result.message || 'Gagal mengubah password.' });
        return;
      }
      showMessage({ type: 'success', text: 'Password berhasil diubah.' });
      form.reset();
    } catch (err: any) {
      showMessage({ type: 'error', text: err?.message || 'Gagal mengubah password.' });
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function refreshAccountInfo(section: HTMLElement) {
  const user = AuthService.getCurrentUser();
  const namaEl = section.querySelector('#akunNama');
  const detailEl = section.querySelector('#akunDetail');
  const avatarEl = section.querySelector('#akunAvatar');

  if (user) {
    if (namaEl) namaEl.textContent = user.nama || user.username;
    if (avatarEl) avatarEl.textContent = (user.nama || user.username || '-').charAt(0).toUpperCase();
    if (detailEl) {
      const roleLabel = user.role === 'admin' ? 'Admin Pusat' : 'User Cabang';
      detailEl.textContent = `@${user.username} • ${roleLabel} • Cabang ${user.cabang || '-'}`;
    }
  } else {
    if (namaEl) namaEl.textContent = '-';
    if (avatarEl) avatarEl.textContent = '-';
    if (detailEl) detailEl.textContent = 'Belum login';
  }
}