import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { EMPTY_FILTER_STATE, type FilterState } from './filterState';

// Counts filters that differ from the baseline (reset) state so that
// pre-set values (e.g. a year's date range from ExpensesPage) don't
// register as user-applied filters.
function countActiveFilters(filters: FilterState, base: FilterState): number {
  let count = 0;
  if (filters.accountId !== base.accountId) count++;
  if (filters.startDate !== base.startDate || filters.endDate !== base.endDate) count++;
  if (filters.categoryId !== base.categoryId || filters.subcategoryId !== base.subcategoryId) count++;
  if (filters.flaggedOnly !== base.flaggedOnly) count++;
  return count;
}

interface Props {
  readonly filters: FilterState;
  readonly onChange: (filters: FilterState) => void;
  // The state "Clear all" resets to. Defaults to EMPTY_FILTER_STATE.
  // Pass the initial defaultFilters so pre-set values (e.g. a date range
  // from a parent page) are preserved on clear rather than wiped.
  readonly resetFilters?: FilterState;
}

export function TransactionFilters({ filters, onChange, resetFilters = EMPTY_FILTER_STATE }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const activeCount = countActiveFilters(filters, resetFilters);

  function update(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch });
  }

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 text-content-secondary',
          activeCount > 0 && 'text-content-primary',
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-content-primary text-white text-xs leading-none">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border-base bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <span className="text-sm font-medium text-content-primary">Filters</span>
            {activeCount > 0 && (
              <button
                onClick={() => onChange(resetFilters)}
                className="text-xs text-content-muted transition-colors hover:text-content-primary"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3 px-4 py-3">
            <div>
              <label htmlFor="filter-account" className="label-xs">Account</label>
              <Select
                id="filter-account"
                value={filters.accountId}
                onChange={(e) => update({ accountId: e.target.value })}
                className="mt-1 w-full"
              >
                <option value="">All accounts</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label htmlFor="filter-start-date" className="label-xs">Date range</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="filter-start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => update({ startDate: e.target.value })}
                  className="select-base min-w-0 flex-1"
                  aria-label="Start date"
                />
                <span className="shrink-0 text-sm text-content-muted">to</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => update({ endDate: e.target.value })}
                  className="select-base min-w-0 flex-1"
                  aria-label="End date"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-category" className="label-xs">Category</label>
              <Select
                id="filter-category"
                value={filters.subcategoryId || filters.categoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  const isSub = categories?.some((c) =>
                    c.subcategories.some((s) => s.id === val)
                  );
                  update(
                    isSub
                      ? { subcategoryId: val, categoryId: '' }
                      : { categoryId: val, subcategoryId: '' }
                  );
                }}
                className="mt-1 w-full"
              >
                <option value="">All categories</option>
                {categories?.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>{cat.name}</option>
                    {cat.subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {'\u00a0\u00a0'}
                        {sub.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="flagged-only"
                type="checkbox"
                checked={filters.flaggedOnly}
                onChange={(e) => update({ flaggedOnly: e.target.checked })}
                className="rounded"
              />
              <label
                htmlFor="flagged-only"
                className="cursor-pointer text-sm text-content-secondary"
              >
                Needs review
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
