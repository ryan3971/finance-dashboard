import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDeleteSubcategory, useRenameSubcategory } from '../hooks/useCategoryMutations';
import { FIELD_LIMITS } from '@finance/shared';
import type { Subcategory } from '@finance/shared';

export function SubcategoryChip({ sub }: { sub: Subcategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sub.name);

  useEffect(() => {
    if (!editing) setName(sub.name);
  }, [sub.name, editing]);

  const rename = useRenameSubcategory();
  const remove = useDeleteSubcategory();

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
