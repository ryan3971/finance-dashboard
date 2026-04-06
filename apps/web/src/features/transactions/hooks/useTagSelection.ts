import { useState } from 'react';

export function useTagSelection(initialIds?: string[]) {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(initialIds ?? [])
  );

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  function resetTags() {
    setSelectedTagIds(new Set());
  }

  return { selectedTagIds, toggleTag, resetTags };
}
