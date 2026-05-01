import { useState } from 'react';
import { AddEntryDialog } from './components/AddEntryDialog';
import { AnticipatedBudgetEntryCard } from './components/AnticipatedBudgetEntryCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { SummaryCards } from './components/SummaryCards';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useAnticipatedBudget } from './hooks/useAnticipatedBudget';
import { useCreateEntry } from './hooks/useAnticipatedBudgetMutations';

export function AnticipatedBudgetPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entries, isPending } = useAnticipatedBudget(year);
  const showSkeleton = useDelayedPending(isPending);
  const createEntry = useCreateEntry();

  const incomeEntries = entries?.filter((e) => e.isIncome) ?? [];
  const expenseEntries = entries?.filter((e) => !e.isIncome) ?? [];

  const needEntries = expenseEntries.filter((e) => e.needWant === 'Need');
  const wantEntries = expenseEntries.filter((e) => e.needWant === 'Want');
  const otherEntries = expenseEntries.filter(
    (e) => e.needWant !== 'Need' && e.needWant !== 'Want'
  );

  const isEmpty = !isPending && entries?.length === 0;

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-content-primary">
            Anticipated Budget
          </h1>
          <div className="flex items-center gap-1">
            <button
              className="text-content-muted hover:text-content-primary transition-colors px-1"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Previous year"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-content-primary w-12 text-center">
              {year}
            </span>
            <button
              className="text-content-muted hover:text-content-primary transition-colors px-1"
              onClick={() => setYear((y) => y + 1)}
              aria-label="Next year"
            >
              ›
            </button>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Add Entry</Button>
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

      {/* Income section */}
      {!isPending && incomeEntries.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
            Income
          </h2>
          <div className="space-y-2">
            {incomeEntries.map((entry) => (
              <AnticipatedBudgetEntryCard
                key={entry.id}
                entry={entry}
              />
            ))}
          </div>
        </section>
      )}

      {/* Expenses section */}
      {!isPending && expenseEntries.length > 0 && (
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
                    <AnticipatedBudgetEntryCard
                      key={entry.id}
                      entry={entry}
                    />
                  ))}
                </div>
              </div>
            )}
            {wantEntries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-accent mb-1.5">Wants</p>
                <div className="space-y-2">
                  {wantEntries.map((entry) => (
                    <AnticipatedBudgetEntryCard
                      key={entry.id}
                      entry={entry}
                    />
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
                    <AnticipatedBudgetEntryCard
                      key={entry.id}
                      entry={entry}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Summary cards */}
      {!isPending && entries && entries.length > 0 && (
        <SummaryCards entries={entries} month={currentMonth} />
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
