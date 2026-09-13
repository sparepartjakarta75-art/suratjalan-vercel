export function renderLoadingScreen(): HTMLElement {
  const div = document.createElement('div');
  div.id = 'loadingScreen';
  div.className = 'fixed inset-0 z-50 flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800';
  div.innerHTML = `
    <div class="text-center space-y-4">
      <div class="flex justify-center">
        <div class="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
      <div class="text-slate-400 text-sm font-medium tracking-wide">Memuat aplikasi...</div>
    </div>
  `;
  return div;
}
