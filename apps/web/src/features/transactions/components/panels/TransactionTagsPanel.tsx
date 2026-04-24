import { DEFAULT_TAG_COLOR, FIELD_LIMITS } from '@finance/shared/constants';
import { type TagFormInput, tagFormSchema } from '@finance/shared/schemas/tags';
import {
  useAttachTag,
  useCreateTag,
  useDetachTag,
  useTags,
} from '@/features/transactions/hooks/useTags';
import type { Tag } from '@finance/shared/schemas/transactions';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

interface Props {
  readonly transactionId: string;
  readonly attachedTags: Tag[];
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TagFormInput>({
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

  // role="none" marks this as a layout container, not an interactive element.
  // stopPropagation prevents clicks/keys inside the tag editor from triggering the row-level detail panel.
  return (
    <div
      className="flex flex-wrap gap-1 items-center"
      role="none"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Attached tags */}
      {attachedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: tag.color ?? DEFAULT_TAG_COLOR }}
        >
          {tag.name}
          <button
            onClick={() => {
              void handleDetach(tag.id);
            }}
            className="hover:opacity-75 leading-none shrink-0"
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
          className="text-xs border border-dashed border-border-strong rounded px-1 py-0.5 text-content-muted bg-transparent"
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
          onSubmit={(e) => {
            void handleSubmit(onCreateSubmit)(e);
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            type="text"
            placeholder="Tag name"
            maxLength={FIELD_LIMITS.TAG_NAME_MAX}
            className="text-xs border border-border-strong rounded px-1.5 py-0.5 w-24"
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
                  newTagColor === c ? 'border-content-primary' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="submit"
            className="text-xs text-content-secondary hover:text-content-primary"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setShowCreate(false);
            }}
            className="text-xs text-content-muted hover:text-content-secondary"
          >
            ✕
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs text-content-muted hover:text-content-secondary border border-dashed border-border-strong rounded px-1.5 py-0.5"
        >
          + new
        </button>
      )}
    </div>
  );
}
