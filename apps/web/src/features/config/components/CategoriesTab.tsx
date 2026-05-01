import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useCategories } from '@/hooks/useCategories';
import { CategorySection } from './CategorySection';

const CATEGORY_SKELETON_ROW_COUNT = 6;

export function CategoriesTab() {
  const { data: categories, isPending, isError } = useCategories();
  const showSkeleton = useDelayedPending(isPending);

  if (showSkeleton) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: CATEGORY_SKELETON_ROW_COUNT }, (_, i) => `skeleton-${i}`).map((id) => (
          <Skeleton key={id} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isPending) return null;

  if (isError)
    return <EmptyState message="Failed to load categories." variant="error" />;
  if (!categories || categories.length === 0)
    return <EmptyState message="No categories found." />;

  const income = categories.filter((c) => c.isIncome);
  const expense = categories.filter((c) => !c.isIncome);

  return (
    <div className="mt-4 space-y-6">
      {[
        { label: 'Income', items: income, isIncome: true },
        { label: 'Expense', items: expense, isIncome: false },
      ].map(({ label, items, isIncome }) =>
        items.length === 0 ? null : (
          <CategorySection
            key={label}
            label={label}
            items={items}
            isIncome={isIncome}
          />
        )
      )}
    </div>
  );
}
