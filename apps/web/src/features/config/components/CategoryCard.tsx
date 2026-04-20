import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SubcategoryChip } from './SubcategoryChip';
import { useCreateSubcategory } from '@/hooks/useCategoryMutations';
import {
  useDeleteCategory,
  useRenameCategory,
} from '../hooks/useCategoryMutations';
import { FIELD_LIMITS } from '@finance/shared/constants';
import type { Category } from '@finance/shared/types/categories';

function AddSubcategoryForm({
  parentId,
  onDone,
}: {
  readonly parentId: string;
  readonly onDone: () => void;
}) {
  const [name, setName] = useState('');
  const create = useCreateSubcategory();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), parentId },
      {
        onSuccess: () => {
          setName('');
          onDone();
        },
      }
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
      <Button
        type="submit"
        size="sm"
        disabled={!name.trim() || create.isPending}
      >
        Add
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

export function CategoryCard({ cat }: { readonly cat: Category }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);

  useEffect(() => {
    if (!editing) setName(cat.name);
  }, [cat.name, editing]);

  const rename = useRenameCategory();
  const remove = useDeleteCategory();

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-1 group">
        {editing ? (
          <span className="inline-flex items-center gap-1 flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={FIELD_LIMITS.SUBCATEGORY_NAME_MAX}
              className="h-6 text-sm w-40"
              autoFocus
            />
            <Button
              size="sm"
              className="h-6 text-xs px-2"
              disabled={!name.trim() || rename.isPending}
              onClick={() =>
                rename.mutate(
                  { id: cat.id, name: name.trim() },
                  { onSuccess: () => setEditing(false) }
                )
              }
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={() => {
                setName(cat.name);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </span>
        ) : (
          <>
            <p className="text-sm font-medium text-content-primary flex-1">
              {cat.name}
            </p>
            <button
              type="button"
              aria-label="Rename category"
              className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-content-primary transition-opacity text-xs"
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
            <button
              type="button"
              aria-label="Delete category"
              className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-danger transition-opacity text-xs"
              disabled={remove.isPending}
              onClick={() => remove.mutate(cat.id)}
            >
              ×
            </button>
          </>
        )}
      </div>
      {cat.subcategories.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {cat.subcategories.map((sub) => (
            <SubcategoryChip key={sub.id} sub={sub} />
          ))}
        </div>
      )}
      {showAdd ? (
        <div className="mt-2">
          <AddSubcategoryForm
            parentId={cat.id}
            onDone={() => setShowAdd(false)}
          />
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
