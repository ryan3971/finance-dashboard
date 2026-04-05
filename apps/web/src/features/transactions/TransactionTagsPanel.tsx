import {
  useAttachTag,
  useCreateTag,
  useDetachTag,
  useTags,
} from '@/hooks/useTags';
import { FIELD_LIMITS, tagFormSchema, type TagFormInput } from '@finance/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Tag } from '@/hooks/useTransactions';
import { useState } from 'react';

interface Props {
  transactionId: string;
  attachedTags: Tag[];
}

const PRESET_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
  '#14B8A6',
];

export function TransactionTagsPanel({ transactionId, attachedTags }: Props) {
  const { data: allTags } = useTags();
  const createTag = useCreateTag();
  const attachTag = useAttachTag();
  const detachTag = useDetachTag();

  const [showCreate, setShowCreate] = useState(false);
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TagFormInput>({
    resolver: zodResolver(tagFormSchema),
  });

  const attachedIds = new Set(attachedTags.map((t) => t.id));
  const availableTags = allTags?.filter((t) => !attachedIds.has(t.id)) ?? [];

  async function handleAttach(tagId: string) {
    await attachTag.mutateAsync({ transactionId, tagId });
  }

  async function handleDetach(tagId: string) {
    await detachTag.mutateAsync({ transactionId, tagId });
  }

  async function onCreateSubmit(values: TagFormInput) {
    const tag = await createTag.mutateAsync({
      name: values.name.trim(),
      color: newTagColor,
    });
    await attachTag.mutateAsync({
      transactionId,
      tagId: tag.id,
    });
    reset();
    setShowCreate(false);
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {/* Attached tags */}
      {attachedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{
            backgroundColor: tag.color ?? '#6B7280',
          }}
        >
          {tag.name}
          <button
            onClick={() => {
              void handleDetach(tag.id);
            }}
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
          onChange={(e) => {
            if (e.target.value) void handleAttach(e.target.value);
            e.target.value = '';
          }}
          className="text-xs border border-dashed border-gray-300 rounded px-1 py-0.5 text-gray-400 bg-transparent"
          defaultValue=""
        >
          <option value="" disabled>
            + tag
          </option>
          {availableTags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {/* Create new tag */}
      {showCreate ? (
        <form
          onSubmit={(e) => { void handleSubmit(onCreateSubmit)(e); }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            type="text"
            placeholder="Tag name"
            maxLength={FIELD_LIMITS.TAG_NAME_MAX}
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-24"
            {...register('name')}
          />
          {errors.name && (
            <span className="text-xs text-danger">{errors.name.message}</span>
          )}
          <div className="flex gap-0.5">
            {PRESET_COLORS.map((c) => (
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
          <button
            type="submit"
            className="text-xs text-gray-700 hover:text-gray-900"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => { reset(); setShowCreate(false); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
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
