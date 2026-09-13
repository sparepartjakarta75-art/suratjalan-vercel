import type { MessageNotification } from '../types';

/** Lazily resolve #msgBox — created dynamically in app.ts after module load */
function getMsgBox(): HTMLElement | null {
  return document.getElementById('msgBox');
}

export function showMessage(
  notification: MessageNotification | string,
  type: 'success' | 'error' | 'info' = 'info'
) {
  const msgBox = getMsgBox();
  if (!msgBox) return;

  let text: string;
  let msgType: 'success' | 'error' | 'info';
  if (typeof notification === 'string') {
    text = notification;
    msgType = type;
  } else {
    text = notification.text;
    msgType = notification.type || 'info';
  }

  msgBox.textContent = text;
  msgBox.className = 'bg-blue-50 text-blue-700 border border-blue-100 p-3.5 rounded-xl text-xs font-medium shadow-sm';

  if (msgType === 'error') {
    msgBox.className = 'bg-red-50 text-red-700 border border-red-100 p-3.5 rounded-xl text-xs font-medium shadow-sm';
  } else if (msgType === 'success') {
    msgBox.className = 'bg-green-50 text-green-700 border border-green-100 p-3.5 rounded-xl text-xs font-medium shadow-sm';
  }

  msgBox.classList.remove('hidden');

  setTimeout(() => {
    msgBox.classList.add('hidden');
  }, 4000);
}

export function showLoading(containerId: string) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = '<div class="flex items-center justify-center py-8"><div class="loading loading-spinner loading-md"></div></div>';
  }
}