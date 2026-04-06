import { CategoriesTab } from './components/CategoriesTab';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { RulesTab } from './components/RulesTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export function ConfigPage() {
  return (
    <PageLayout>
      <h1 className="text-lg font-semibold text-content-primary mb-4">Configuration</h1>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="rules">
          <RulesTab />
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
