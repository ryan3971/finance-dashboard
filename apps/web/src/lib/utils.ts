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

/** Formats `part / total` as a percentage string (e.g. "42.3%"), or null when total is 0. */
export function fmtPct(part: number, total: number): string | null {
  if (total === 0) return null;
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function parseAmount(s: string | null | undefined): number {
  if (s === null || s === undefined || s === '') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Returns a sort-direction arrow suffix for use in table column headers. */
export function sortIndicator(dir: false | 'asc' | 'desc'): ' ↑' | ' ↓' | '' {
  if (dir === 'asc') return ' ↑';
  if (dir === 'desc') return ' ↓';
  return '';
}

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function getMonthDateRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getYearDateRange(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}
