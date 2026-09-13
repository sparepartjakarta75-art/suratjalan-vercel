// ============================================================
// PAGINATION UTILITIES (shared across list pages)
// ============================================================

export const UKURAN_HALAMAN = 10;

export interface PagedResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export function paginate<T>(all: T[], page: number, perPage: number = UKURAN_HALAMAN): PagedResult<T> {
  const totalItems = all.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: all.slice(start, start + perPage),
    page: safePage,
    totalPages,
    totalItems,
  };
}

// Normalisasi format tanggal apa pun ke yyyy-MM-dd agar bisa dibandingkan.
export function normalizeDate(value: string): string {
  if (!value) return '';
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return v;
}

// Mengambil daftar nilai unik (untuk isi <select> filter).
export function uniqueValues<T>(list: T[], getter: (item: T) => string | undefined | null): string[] {
  const map: Record<string, boolean> = {};
  list.forEach(item => {
    const val = getter(item);
    if (val && String(val).trim()) map[String(val).trim()] = true;
  });
  return Object.keys(map).sort((a, b) => a.localeCompare(b));
}

export function renderPagination(
  container: HTMLElement | null,
  result: PagedResult<any>,
  onSelect: (page: number) => void,
  infoLabel: string = '',
): void {
  if (!container) return;
  if (result.totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  const pages: number[] = [];
  const total = result.totalPages;
  const current = result.page;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - current) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1);
    }
  }

  const base = 'inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-lg text-sm transition-colors select-none';
  const btn = `${base} text-slate-600 hover:bg-slate-100`;
  const active = `${base} bg-blue-600 text-white font-semibold cursor-default`;
  const dot = `${base} text-slate-400 cursor-default`;

  let html = '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 pt-1">';
  html += `<div class="text-xs text-slate-500">${infoLabel || `Menampilkan ${result.items.length} dari ${result.totalItems} data`}${result.totalPages > 1 ? ` &middot; Halaman ${current} dari ${total}` : ''}</div>`;

  if (total > 1) {
    html += '<div class="flex items-center gap-1.5">';
    html += `<button type="button" class="${btn}" data-page="1" ${current === 1 ? 'disabled' : ''} title="Halaman pertama"><i class="bi bi-chevron-bar-left"></i></button>`;
    html += `<button type="button" class="${btn}" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} title="Halaman sebelumnya"><i class="bi bi-chevron-left"></i></button>`;
    pages.forEach(p => {
      if (p === -1) {
        html += `<span class="${dot}"><i class="bi bi-three-dots"></i></span>`;
      } else {
        html += `<button type="button" class="${p === current ? active : btn}" data-page="${p}" ${p === current ? 'disabled' : ''}>${p}</button>`;
      }
    });
    html += `<button type="button" class="${btn}" data-page="${current + 1}" ${current === total ? 'disabled' : ''} title="Halaman berikutnya"><i class="bi bi-chevron-right"></i></button>`;
    html += `<button type="button" class="${btn}" data-page="${total}" ${current === total ? 'disabled' : ''} title="Halaman terakhir"><i class="bi bi-chevron-bar-right"></i></button>`;
    html += '</div>';
  } else {
    html += '<div></div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Event delegation: pasang sekali, menangani klik ulang setelah innerHTML diganti.
  if (!container.dataset.paginationBound) {
    container.dataset.paginationBound = '1';
    container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-page]');
      if (!btn) return;
      const page = Number((btn as HTMLElement).dataset.page);
      if (page > 0 && page !== result.page) onSelect(page);
    });
  }
}

// Ambil nilai filter (dengan fallback kalau elemen belum ada).
export function getFilterValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return el ? el.value : '';
}