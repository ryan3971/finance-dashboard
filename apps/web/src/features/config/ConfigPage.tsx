import { useState } from 'react';
import { CategoriesTab } from './components/CategoriesTab';
import { PageLayout } from '@/components/layout/PageLayout';
import { PreferencesTab } from './components/PreferencesTab';
import { RulesTab } from './components/RulesTab';
import { SectionHelp } from '@/components/common/SectionHelp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { helpContent } from '@/lib/helpContent';

type ConfigTab = 'categories' | 'rules' | 'preferences';

const CONFIG_HELP_KEYS: Record<ConfigTab, keyof typeof helpContent> = {
  categories: 'config.categories',
  rules: 'config.rules',
  preferences: 'config.preferences',
};

function isConfigTab(v: string): v is ConfigTab {
  return v in CONFIG_HELP_KEYS;
}

export function ConfigPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('categories');

  return (
    <PageLayout>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-lg font-semibold text-content-primary">Configuration</h1>
        <SectionHelp contentKey={CONFIG_HELP_KEYS[activeTab]} />
      </div>
      <Tabs value={activeTab} onValueChange={(v) => { if (isConfigTab(v)) setActiveTab(v); }}>
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
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
