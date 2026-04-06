import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateSubcategory,
  useDeleteSubcategory,
  useRenameSubcategory,
} from '../hooks/useCategoryMutations';
import { FIELD_LIMITS } from '@finance/shared';
import type { Category, Subcategory } from '@finance/shared';

function AddSubcategoryForm({ parentId, onDone }: { parentId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const create = useCreateSubcategory();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), parentId },
      { onSuccess: () => { setName(''); onDone(); } },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New subcategory name"
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

function SubcategoryChip({ sub }: { sub: Subcategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sub.name);

  useEffect(() => {
    if (!editing) setName(sub.name);
  }, [sub.name, editing]);

  const rename = useRenameSubcategory();
  const remove = useDeleteSubcategory();

  if (!sub.userId) {
    return (
      <span className="inline-block text-xs text-content-secondary bg-surface-muted rounded px-2 py-0.5">
        {sub.name}
      </span>
    );
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={FIELD_LIMITS.SUBCATEGORY_NAME_MAX}
          className="h-6 text-xs w-36"
          autoFocus
        />
        <Button
          size="sm"
          className="h-6 text-xs px-2"
          disabled={!name.trim() || rename.isPending}
          onClick={() =>
            rename.mutate(
              { id: sub.id, name: name.trim() },
              { onSuccess: () => setEditing(false) },
            )
          }
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={() => { setName(sub.name); setEditing(false); }}
        >
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-surface-muted rounded px-2 py-0.5 group">
      <span className="text-content-secondary">{sub.name}</span>
      <button
        type="button"
        aria-label="Rename"
        className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-content-primary transition-opacity"
        onClick={() => setEditing(true)}
      >
        ✎
      </button>
      <button
        type="button"
        aria-label="Delete"
        className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-danger transition-opacity"
        disabled={remove.isPending}
        onClick={() => remove.mutate(sub.id)}
      >
        ×
      </button>
    </span>
  );
}

function CategoryCard({ cat }: { cat: Category }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="px-4 py-2.5">
      <p className="text-sm font-medium text-content-primary">{cat.name}</p>
      {cat.subcategories.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {cat.subcategories.map((sub) => (
            <SubcategoryChip key={sub.id} sub={sub} />
          ))}
        </div>
      )}
      {showAdd ? (
        <div className="mt-2">
          <AddSubcategoryForm parentId={cat.id} onDone={() => setShowAdd(false)} />
        </div>
      ) : (
        <button
          type="button"
          className="mt-1.5 text-xs text-content-muted hover:text-content-primary"
          onClick={() => setShowAdd(true)}
        >
          + Add subcategory
        </button>
      )}
    </div>
  );
}

export function CategoriesTab() {
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

  if (isError) return <EmptyState message="Failed to load categories." variant="error" />;
  if (!categories || categories.length === 0) return <EmptyState message="No categories found." />;

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
                <CategoryCard key={cat.id} cat={cat} />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
