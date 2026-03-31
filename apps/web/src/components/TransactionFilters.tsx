import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';

export interface FilterState {
  accountId: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  flaggedOnly: boolean;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function TransactionFilters({ filters, onChange }: Props) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  function update(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Account */}
      <select
        value={filters.accountId}
        onChange={e => update({ accountId: e.target.value })}
        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
      >
        <option value="">All accounts</option>
        {accounts?.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        value={filters.startDate}
        onChange={e => update({ startDate: e.target.value })}
        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        value={filters.endDate}
        onChange={e => update({ endDate: e.target.value })}
        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
      />

      {/* Category */}
      <select
        value={filters.categoryId}
        onChange={e => update({ categoryId: e.target.value })}
        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
      >
        <option value="">All categories</option>
        {categories?.map(cat => (
          <optgroup key={cat.id} label={cat.name}>
            <option value={cat.id}>{cat.name}</option>
            {cat.subcategories.map(sub => (
              <option key={sub.id} value={sub.id}>
                {'\u00a0\u00a0'}{sub.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Flagged toggle */}
      <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.flaggedOnly}
          onChange={e => update({ flaggedOnly: e.target.checked })}
          className="rounded"
        />
        Needs review
      </label>
    </div>
  );
}