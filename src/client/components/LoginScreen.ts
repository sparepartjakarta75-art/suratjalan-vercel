import { AuthService } from '../services/auth';
import { showMessage } from '../utils/messaging';

export function renderLoginScreen(): HTMLElement {
  const div = document.createElement('div');
  div.id = 'loginScreen';
  div.style.display = 'none';
  div.className = 'fixed inset-0 z-40 flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-4';
  
  div.innerHTML = `
    <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 border border-slate-100">
      <div class="text-center mb-8">
        <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg">
          📦
        </div>
        <h1 class="text-2xl font-bold text-slate-900 mb-2">Surat Jalan Pusat</h1>
        <p class="text-sm text-slate-500">Sistem Pengiriman Barang Cabang → Pusat</p>
      </div>

      <div id="loginError" class="hidden bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg text-sm mb-4 font-medium"></div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Username</label>
          <input 
            type="text" 
            id="loginUsername" 
            class="sj-input sj-input-lg"
            placeholder="Masukkan username"
            autocomplete="username"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Password</label>
          <input 
            type="password" 
            id="loginPassword" 
            class="sj-input sj-input-lg"
            placeholder="Masukkan password"
            autocomplete="current-password"
          />
        </div>

        <button 
          id="btnAuthLogin" 
          class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg text-sm transition duration-200 shadow-lg shadow-blue-500/20 mt-6"
        >
          <span class="inline-flex items-center gap-2">
            <span>Masuk ke Aplikasi</span>
          </span>
        </button>
      </div>
    </div>
  `;

  // Setup event listeners
  setupLoginEvents(div);
  return div;
}

function setupLoginEvents(container: HTMLElement) {
  const usernameInput = container.querySelector('#loginUsername') as HTMLInputElement;
  const passwordInput = container.querySelector('#loginPassword') as HTMLInputElement;
  const loginBtn = container.querySelector('#btnAuthLogin') as HTMLButtonElement;
  const errorBox = container.querySelector('#loginError') as HTMLElement;

  function clearError() {
    errorBox.classList.add('hidden');
  }

  function showError(message: string) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  async function doLogin() {
    clearError();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Username dan password wajib diisi.');
      return;
    }

    const origText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="inline-flex items-center gap-2"><span class="loading loading-spinner loading-sm"></span><span>Memproses...</span></span>';

    try {
      await AuthService.login(username, password);
      
      // Trigger login success event
      window.dispatchEvent(new CustomEvent('login-success'));
      
      // Clear inputs
      usernameInput.value = '';
      passwordInput.value = '';
      
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Terjadi kesalahan saat login.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = origText;
    }
  }

  loginBtn.addEventListener('click', doLogin);
  
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
}
