import { useCallback, useState } from 'react';
import { cn, getMonthDateRange, getYearDateRange } from '@/lib/utils';
import { PageLayout } from '@/components/layout/PageLayout';
import { TransactionTablePane } from '@/components/transactions/TransactionTablePane';
import { YearSelector } from '@/components/common/YearSelector';
import { ExpenseCategoryBreakdown } from './components/ExpenseCategoryBreakdown';
import { ExpenseMonthlyBreakdown } from './components/ExpenseMonthlyBreakdown';

type ActiveTab = 'transactions' | 'categories';

export function ExpensesPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('transactions');

  const handleYearChange = useCallback((newYear: number) => {
    setYear(newYear);
    setMonthFilter(null);
  }, []);

  const dateRange = monthFilter
    ? getMonthDateRange(year, monthFilter)
    : getYearDateRange(year);

  return (
    <PageLayout>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Expenses</h1>
        <YearSelector year={year} onChange={handleYearChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6">
        {/* Left: Monthly Breakdown — full height */}
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Monthly Breakdown
          </h2>
          <ExpenseMonthlyBreakdown
            year={year}
            selectedMonth={monthFilter}
            onMonthSelect={setMonthFilter}
          />
        </div>

        {/* Right: Tabbed card */}
        <div className="flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-border-base mb-4">
            {(['transactions', 'categories'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                  activeTab === tab
                    ? 'border-content-primary text-content-primary'
                    : 'border-transparent text-content-secondary hover:text-content-primary',
                )}
              >
                {tab === 'transactions' ? 'Transactions' : 'Categories'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'transactions' && (
            <TransactionTablePane
              key={`${year}-${monthFilter ?? 'all'}`}
              presetFilters={{ isIncome: false }}
              defaultFilters={{
                startDate: dateRange.start,
                endDate: dateRange.end,
              }}
              onFilterChange={(newFilters) => {
                if (
                  newFilters.startDate !== dateRange.start ||
                  newFilters.endDate !== dateRange.end
                ) {
                  setMonthFilter(null);
                }
              }}
            />
          )}
          {activeTab === 'categories' && (
            <ExpenseCategoryBreakdown year={year} monthFilter={monthFilter} />
          )}
        </div>
      </div>
    </PageLayout>
  );
}
