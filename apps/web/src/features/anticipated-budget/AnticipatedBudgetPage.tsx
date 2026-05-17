import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { SectionHelp } from '@/components/common/SectionHelp';
import { AddEntryDialog } from './components/AddEntryDialog';
import { AnticipatedBudgetEntryCard } from './components/AnticipatedBudgetEntryCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SummaryCards } from './components/SummaryCards';
import { YearSelector } from '@/components/common/YearSelector';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useAnticipatedBudget } from './hooks/useAnticipatedBudget';
import { useCreateEntry, useCopyFromYear } from './hooks/useAnticipatedBudgetMutations';
import type { AnticipatedBudgetEntry } from '@finance/shared/types/anticipated-budget';

const SORT_OPTIONS = [
  { value: 'default',      label: 'Default order' },
  { value: 'name-asc',     label: 'Name A→Z' },
  { value: 'name-desc',    label: 'Name Z→A' },
  { value: 'amount-desc',  label: 'Amount (high→low)' },
  { value: 'amount-asc',   label: 'Amount (low→high)' },
] as const;

type SortOrder = (typeof SORT_OPTIONS)[number]['value'];

function sortedEntries(entries: AnticipatedBudgetEntry[], order: SortOrder): AnticipatedBudgetEntry[] {
  if (order === 'default') return entries;

  // Pre-compute yearly totals so each is calculated once, not once per comparison.
  const withTotals = entries.map((e) => ({
    entry: e,
    total: e.months.reduce((sum, m) => sum + m.amount, 0),
  }));

  withTotals.sort((a, b) => {
    switch (order) {
      case 'name-asc':    return a.entry.name.localeCompare(b.entry.name);
      case 'name-desc':   return b.entry.name.localeCompare(a.entry.name);
      case 'amount-desc': return b.total - a.total;
      case 'amount-asc':  return a.total - b.total;
    }
  });

  return withTotals.map((x) => x.entry);
}

export function AnticipatedBudgetPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const { data: entries, isPending, isFetching } = useAnticipatedBudget(year);
  const showSkeleton = useDelayedPending(isPending);
  const createEntry = useCreateEntry();
  const copyFromYear = useCopyFromYear();

  const hasEntries = (entries?.length ?? 0) > 0;

  const sorted = useMemo(
    () => sortedEntries(entries ?? [], sortOrder),
    [entries, sortOrder],
  );

  const incomeEntries = sorted.filter((e) => e.isIncome);
  const expenseEntries = sorted.filter((e) => !e.isIncome);

  const needEntries = expenseEntries.filter((e) => e.needWant === 'Need');
  const wantEntries = expenseEntries.filter((e) => e.needWant === 'Want');
  const otherEntries = expenseEntries.filter(
    (e) => e.needWant !== 'Need' && e.needWant !== 'Want'
  );

  const isEmpty = !isPending && !hasEntries;

  function handleYearChange(newYear: number) {
    setYear(newYear);
    setSortOrder('default');
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const match = SORT_OPTIONS.find((o) => o.value === e.target.value);
    if (match) setSortOrder(match.value);
  }

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-content-primary">
              Anticipated Budget
            </h1>
            <SectionHelp contentKey="anticipatedBudget.entryList" />
          </div>
          <YearSelector year={year} onChange={handleYearChange} />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortOrder} onChange={handleSortChange} aria-label="Sort entries">
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={copyFromYear.isPending || hasEntries}
            onClick={() => copyFromYear.mutate({ fromYear: year - 1, toYear: year })}
          >
            {copyFromYear.isPending ? 'Copying…' : `Copy from ${year - 1}`}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>Add Entry</Button>
        </div>
      </div>

      {/* Loading */}
      {showSkeleton && (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => `skeleton-${i}`).map((key) => (
            <Skeleton key={key} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <EmptyState
          message="No anticipated budget entries for this year."
          hint="Add your anticipated income and expenses to unlock spending insights."
        />
      )}

      {entries && (
        <div className={cn('transition-opacity duration-200', isFetching && 'opacity-50')}>
          {/* Income section */}
          {incomeEntries.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                Income
              </h2>
              <div className="space-y-2">
                {incomeEntries.map((entry) => (
                  <AnticipatedBudgetEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {/* Expenses section */}
          {expenseEntries.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                Expenses
              </h2>
              <div className="space-y-4">
                {needEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-info mb-1.5">Needs</p>
                    <div className="space-y-2">
                      {needEntries.map((entry) => (
                        <AnticipatedBudgetEntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
                {wantEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-accent mb-1.5">Wants</p>
                    <div className="space-y-2">
                      {wantEntries.map((entry) => (
                        <AnticipatedBudgetEntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
                {otherEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-content-muted mb-1.5">
                      Other
                    </p>
                    <div className="space-y-2">
                      {otherEntries.map((entry) => (
                        <AnticipatedBudgetEntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Summary cards */}
          {hasEntries && (
            <SummaryCards entries={entries} month={currentMonth} />
          )}
        </div>
      )}

      {/* Add entry dialog */}
      <AddEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        effectiveYear={year}
        isPending={createEntry.isPending}
        onSubmit={(input) => {
          createEntry.mutate(input, {
            onSuccess: () => setDialogOpen(false),
          });
        }}
      />
    </PageLayout>
  );
}
