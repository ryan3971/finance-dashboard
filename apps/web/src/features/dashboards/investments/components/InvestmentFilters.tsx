import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAccounts } from '@/hooks/useAccounts';

const INVESTMENT_TYPES = new Set(['tfsa', 'rrsp', 'fhsa', 'non-registered']);
const SYMBOL_DEBOUNCE_MS = 300;

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'fee', label: 'Fee' },
];

interface FilterState {
  accountId?: string;
  action?: string;
  symbol?: string;
  startDate?: string;
  endDate?: string;
}

interface Props {
  readonly filters: FilterState;
}

export function InvestmentFilters({ filters }: Props) {
  const navigate = useNavigate({ from: '/dashboard/investments' });
  const { data: allAccounts } = useAccounts();
  const investmentAccounts = allAccounts?.filter((a) => INVESTMENT_TYPES.has(a.type)) ?? [];

  const [symbolInput, setSymbolInput] = useState(filters.symbol ?? '');

  // Sync symbolInput if URL param changes externally (e.g. back/forward)
  useEffect(() => {
    setSymbolInput(filters.symbol ?? '');
  }, [filters.symbol]);

  // Debounce symbol → URL
  useEffect(() => {
    const trimmed = symbolInput.trim() || undefined;
    if (trimmed === (filters.symbol ?? undefined)) return;
    const id = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, symbol: trimmed, page: undefined }),
      });
    }, SYMBOL_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [symbolInput, filters.symbol, navigate]);

  function setFilter(patch: Partial<FilterState>) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
    });
  }

  return (
    <div className="flex flex-wrap gap-2 items-end">
      {/* Account */}
      <div>
        <label className="label-xs block">Account</label>
        <select
          className="select-base"
          value={filters.accountId ?? ''}
          onChange={(e) =>
            setFilter({ accountId: e.target.value || undefined })
          }
        >
          <option value="">All accounts</option>
          {investmentAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Action */}
      <div>
        <label className="label-xs block">Action</label>
        <select
          className="select-base"
          value={filters.action ?? ''}
          onChange={(e) => setFilter({ action: e.target.value || undefined })}
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Symbol */}
      <div>
        <label className="label-xs block">Symbol</label>
        <input
          type="text"
          placeholder="e.g. VFV"
          className="input-base uppercase w-28"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
        />
      </div>

      {/* Start date */}
      <div>
        <label className="label-xs block">From</label>
        <input
          type="date"
          className="select-base"
          value={filters.startDate ?? ''}
          onChange={(e) =>
            setFilter({ startDate: e.target.value || undefined })
          }
        />
      </div>

      {/* End date */}
      <div>
        <label className="label-xs block">To</label>
        <input
          type="date"
          className="select-base"
          value={filters.endDate ?? ''}
          onChange={(e) =>
            setFilter({ endDate: e.target.value || undefined })
          }
        />
      </div>

      {/* Clear */}
      {(filters.accountId ??
        filters.action ??
        filters.symbol ??
        filters.startDate ??
        filters.endDate) && (
        <button
          onClick={() =>
            setFilter({
              accountId: undefined,
              action: undefined,
              symbol: undefined,
              startDate: undefined,
              endDate: undefined,
            })
          }
          className="text-xs text-content-muted hover:text-content-primary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
