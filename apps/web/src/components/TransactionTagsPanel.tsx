import { useState } from 'react';
import { useTags, useCreateTag, useAttachTag, useDetachTag } from '../hooks/useTags';
import type { Tag } from '../hooks/useTransactions';

interface Props {
  transactionId: string;
  attachedTags: Tag[];
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6',
];

export function TransactionTagsPanel({ transactionId, attachedTags }: Props) {
  const { data: allTags } = useTags();
  const createTag = useCreateTag();
  const attachTag = useAttachTag();
  const detachTag = useDetachTag();

  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  const attachedIds = new Set(attachedTags.map(t => t.id));
  const availableTags = allTags?.filter(t => !attachedIds.has(t.id)) ?? [];

  async function handleAttach(tagId: string) {
    await attachTag.mutateAsync({ transactionId, tagId });
  }

  async function handleDetach(tagId: string) {
    await detachTag.mutateAsync({ transactionId, tagId });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    const tag = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
    await attachTag.mutateAsync({ transactionId, tagId: tag.id });
    setNewTagName('');
    setShowCreate(false);
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {/* Attached tags */}
      {attachedTags.map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: tag.color ?? '#6B7280' }}
        >
          {tag.name}
          <button
            onClick={() => handleDetach(tag.id)}
            className="hover:opacity-75 leading-none"
            title="Remove tag"
          >
            ×
          </button>
        </span>
      ))}

      {/* Add existing tag */}
      {availableTags.length > 0 && (
        <select
          onChange={e => { if (e.target.value) handleAttach(e.target.value); e.target.value = ''; }}
          className="text-xs border border-dashed border-gray-300 rounded px-1 py-0.5 text-gray-400 bg-transparent"
          defaultValue=""
        >
          <option value="" disabled>+ tag</option>
          {availableTags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      {/* Create new tag */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="Tag name"
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-24"
            maxLength={50}
          />
          <div className="flex gap-0.5">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewTagColor(c)}
                className={`w-3.5 h-3.5 rounded-full border-2 ${
                  newTagColor === c ? 'border-gray-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button type="submit" className="text-xs text-gray-700 hover:text-gray-900">✓</button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded px-1.5 py-0.5"
        >
          + new
        </button>
      )}
    </div>
  );
}