import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCategories } from '@/hooks/useCategories';

function CategoriesList() {
  const { data: categories, isLoading, isError } = useCategories();

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <EmptyState message="Failed to load categories." variant="error" />;
  }

  if (!categories || categories.length === 0) {
    return <EmptyState message="No categories found." />;
  }

  const income = categories.filter((c) => c.isIncome);
  const expense = categories.filter((c) => !c.isIncome);

  return (
    <div className="mt-4 space-y-6">
      {[
        { label: 'Income', items: income },
        { label: 'Expense', items: expense },
      ].map(({ label, items }) =>
        items.length === 0 ? null : (
          <div key={label}>
            <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
              {label}
            </h3>
            <div className="bg-white rounded border border-border-base divide-y divide-border-subtle">
              {items.map((cat) => (
                <div key={cat.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-content-primary">
                    {cat.name}
                  </p>
                  {cat.subcategories.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {cat.subcategories.map((sub) => (
                        <span
                          key={sub.id}
                          className="inline-block text-xs text-content-secondary bg-surface-muted rounded px-2 py-0.5"
                        >
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

export function ConfigPage() {
  return (
    <PageLayout>
      <h1 className="text-lg font-semibold text-content-primary mb-4">
        Configuration
      </h1>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoriesList />
        </TabsContent>

        <TabsContent value="rules">
          <div className="mt-4">
            <EmptyState
              message="Rules management coming soon."
              hint="Auto-categorisation rules will be configurable here."
            />
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="mt-4">
            <EmptyState message="Preferences coming soon." />
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
