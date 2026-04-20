import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

export function parseAmount(s: string | null | undefined): number {
  if (s === null || s === undefined || s === '') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Formats `part / total` as a percentage string (e.g. "42.3%"), or null when total is 0. */
export function fmtPct(part: number, total: number): string | null {
  if (total === 0) return null;
  return `${((part / total) * 100).toFixed(1)}%`;
}

/** Returns a sort-direction arrow suffix for use in table column headers. */
export function sortIndicator(dir: false | 'asc' | 'desc'): ' ↑' | ' ↓' | '' {
  if (dir === 'asc') return ' ↑';
  if (dir === 'desc') return ' ↓';
  return '';
}

/** Standard dashboard table header cell classes. */
export const TH_CLASS =
  'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider';

/** Standard dashboard table data cell classes. */
export const TD_CLASS = 'px-4 py-3 text-sm text-content-secondary';

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
