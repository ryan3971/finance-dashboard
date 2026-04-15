import { Select } from '@/components/ui/Select';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';

export interface FilterState {
  accountId: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  subcategoryId: string;
  flaggedOnly: boolean;
}

interface Props {
  readonly filters: FilterState;
  readonly onChange: (filters: FilterState) => void;
}

export function TransactionFilters({ filters, onChange }: Props) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  function update(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select
        value={filters.accountId}
        onChange={(e) => update({ accountId: e.target.value })}
      >
        <option value="">All accounts</option>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>

      <input
        type="date"
        value={filters.startDate}
        onChange={(e) => update({ startDate: e.target.value })}
        className="select-base"
      />
      <span className="text-content-muted text-sm">to</span>
      <input
        type="date"
        value={filters.endDate}
        onChange={(e) => update({ endDate: e.target.value })}
        className="select-base"
      />

      <Select
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

      <div className="flex items-center gap-1.5 text-sm text-content-secondary">
        <input
          id="flagged-only"
          type="checkbox"
          checked={filters.flaggedOnly}
          onChange={(e) => update({ flaggedOnly: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="flagged-only" className="cursor-pointer">
          Needs review
        </label>
      </div>
    </div>
  );
}
