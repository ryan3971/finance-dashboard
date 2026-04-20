import { useCallback, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { TransactionTablePane } from '@/components/transactions/TransactionTablePane';
import { YearSelector } from '@/components/common/YearSelector';
import { ExpenseCategoryBreakdown } from './components/ExpenseCategoryBreakdown';
import { ExpenseMonthlyBreakdown } from './components/ExpenseMonthlyBreakdown';
import { getMonthDateRange, getYearDateRange } from './utils/categoryTree';

export function ExpensesPage() {
  // Lazy initializer so the year is evaluated at first render, not module load.
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

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

      {/* Monthly breakdown and expense transactions side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start mb-8">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Monthly Breakdown
          </h2>
          <ExpenseMonthlyBreakdown
            year={year}
            selectedMonth={monthFilter}
            onMonthSelect={setMonthFilter}
          />
        </div>

        <div className="min-w-0">
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Expense Transactions
          </h2>
          {/* key forces a full remount when the filter changes, resetting TransactionTablePane's internal state */}
          <TransactionTablePane
            key={`${year}-${monthFilter ?? 'all'}`}
            presetFilters={{ isIncome: false }}
            defaultFilters={{
              startDate: dateRange.start,
              endDate: dateRange.end,
            }}
            onFilterChange={(newFilters) => {
              // If the user manually changes the date range in the filter
              // panel, clear the month selection so the breakdown table and
              // transaction list stay in sync.
              if (
                newFilters.startDate !== dateRange.start ||
                newFilters.endDate !== dateRange.end
              ) {
                setMonthFilter(null);
              }
            }}
          />
        </div>
      </div>

      {/* Category breakdown: full width */}
      <ExpenseCategoryBreakdown year={year} monthFilter={monthFilter} />
    </PageLayout>
  );
}
