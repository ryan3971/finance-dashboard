import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryCard } from './CategoryCard';
import { useCreateCategory } from '../hooks/useCategoryMutations';
import { FIELD_LIMITS } from '@finance/shared';
import type { Category } from '@finance/shared';

function AddCategoryForm({ isIncome, onDone }: { isIncome: boolean; onDone: () => void }) {
  const [name, setName] = useState('');
  const create = useCreateCategory();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), isIncome },
      { onSuccess: () => { setName(''); onDone(); } },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New category name"
        maxLength={FIELD_LIMITS.SUBCATEGORY_NAME_MAX}
        className="h-7 text-sm flex-1"
      />
      <Button type="submit" size="sm" disabled={!name.trim() || create.isPending}>
        Add
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

export function CategorySection({
  label,
  items,
  isIncome,
}: {
  label: string;
  items: Category[];
  isIncome: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
        {label}
      </h3>
      <div className="bg-white rounded border border-border-base divide-y divide-border-subtle">
        {items.map((cat) => (
          <CategoryCard key={cat.id} cat={cat} />
        ))}
        <div className="px-4 py-2">
          {showAdd ? (
            <AddCategoryForm isIncome={isIncome} onDone={() => setShowAdd(false)} />
          ) : (
            <button
              type="button"
              className="text-xs text-content-muted hover:text-content-primary"
              onClick={() => setShowAdd(true)}
            >
              + Add category
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
