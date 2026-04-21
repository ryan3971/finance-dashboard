import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useRebalancingGroups } from '@/features/transactions/hooks/useRebalancingGroups';
import {
  useAddGroupMember,
  useCreateGroup,
  useRemoveGroupMember,
} from '@/features/transactions/hooks/useRebalancingMutations';
import type { RebalancingRole } from '@finance/shared/types/rebalancing';
import { REBALANCING_GROUP_LABEL_MAX } from '@finance/shared/constants';

const newGroupSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .max(REBALANCING_GROUP_LABEL_MAX, `Max ${String(REBALANCING_GROUP_LABEL_MAX)} characters`),
});
type NewGroupForm = z.infer<typeof newGroupSchema>;

interface RebalancingPanelProps {
  readonly transactionId: string;
  readonly description: string;
  readonly rebalancingGroupId: string | null;
  readonly rebalancingRole: RebalancingRole | null;
  readonly onClose: () => void;
}

// ─── Role toggle ──────────────────────────────────────────────────────────────

function RoleToggle({
  value,
  onChange,
}: {
  readonly value: RebalancingRole;
  readonly onChange: (role: RebalancingRole) => void;
}) {
  return (
    <div className="flex rounded border border-border-strong overflow-hidden">
      {(['source', 'offset'] as const).map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors',
            value === role
              ? 'bg-content-primary text-white'
              : 'text-content-secondary hover:bg-surface-subtle'
          )}
        >
          {role}
        </button>
      ))}
    </div>
  );
}

// ─── Add to group section ─────────────────────────────────────────────────────

function AddToGroupSection({
  transactionId,
  onClose,
}: {
  readonly transactionId: string;
  readonly onClose: () => void;
}) {
  const [role, setRole] = useState<RebalancingRole>('source');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const createGroup = useCreateGroup();
  const addMember = useAddGroupMember();
  const { data } = useRebalancingGroups();
  const groups = data?.groups ?? [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewGroupForm>({
    resolver: zodResolver(newGroupSchema),
    defaultValues: { label: '' },
  });

  function onSubmitNew(values: NewGroupForm) {
    createGroup.mutate(
      { label: values.label, initialTransactionId: transactionId, role },
      { onSuccess: onClose }
    );
  }

  function onSubmitExisting() {
    if (!selectedGroupId) return;
    addMember.mutate(
      { groupId: selectedGroupId, input: { transactionId, role } },
      { onSuccess: onClose }
    );
  }

  const isSubmitting = createGroup.isPending || addMember.isPending;

  return (
    <div className="space-y-4">
      {/* Role */}
      <div>
        <p className="label-xs mb-1.5">Role in group</p>
        <RoleToggle value={role} onChange={setRole} />
        <p className="mt-1.5 text-xs text-content-muted">
          {role === 'source'
            ? 'This transaction is the original expense being split.'
            : 'This transaction offsets or reimburses the source.'}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['new', 'existing'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'px-3 py-1 text-xs rounded border transition-colors',
              mode === m
                ? 'bg-content-primary text-white border-content-primary'
                : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
            )}
          >
            {m === 'new' ? 'New group' : `Existing (${String(groups.length)})`}
          </button>
        ))}
      </div>

      {/* New group form */}
      {mode === 'new' && (
        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmitNew)(e);
          }}
          className="space-y-3"
        >
          <FormField
            label="Group label"
            error={errors.label?.message}
            labelSize="xs"
          >
            <Input
              type="text"
              placeholder="e.g. Dinner with Alex"
              {...register('label')}
            />
          </FormField>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating…' : 'Create group'}
          </Button>
        </form>
      )}

      {/* Existing group list */}
      {mode === 'existing' && (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <p className="text-sm text-content-muted py-2">No groups yet.</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer text-sm transition-colors',
                    selectedGroupId === group.id
                      ? 'bg-surface-muted'
                      : 'hover:bg-surface-subtle'
                  )}
                >
                  <input
                    type="radio"
                    name="groupId"
                    value={group.id}
                    checked={selectedGroupId === group.id}
                    onChange={() => setSelectedGroupId(group.id)}
                    className="shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-content-primary">
                      {group.label}
                    </span>
                    <span className="text-xs text-content-muted capitalize">
                      {group.status}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={!selectedGroupId || isSubmitting}
            onClick={onSubmitExisting}
          >
            {isSubmitting ? 'Adding…' : 'Add to group'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Remove from group section ────────────────────────────────────────────────

function RemoveFromGroupSection({
  transactionId,
  groupId,
  role,
  onClose,
}: {
  readonly transactionId: string;
  readonly groupId: string;
  readonly role: RebalancingRole;
  readonly onClose: () => void;
}) {
  const removeMember = useRemoveGroupMember();
  const { data } = useRebalancingGroups();
  const group = data?.groups.find((g) => g.id === groupId);

  function handleRemove() {
    removeMember.mutate({ groupId, transactionId }, { onSuccess: onClose });
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-subtle rounded-md px-3 py-3 space-y-1 border border-border-subtle">
        <p className="text-xs text-content-muted">Current group</p>
        <p className="text-sm font-medium text-content-primary">
          {group?.label ?? '—'}
        </p>
        <p className="text-xs text-content-muted">
          Role:{' '}
          <span className="text-content-secondary capitalize">{role}</span>
        </p>
      </div>
      <Button
        variant="warning"
        size="sm"
        disabled={removeMember.isPending}
        onClick={handleRemove}
      >
        {removeMember.isPending ? 'Removing…' : 'Remove from group'}
      </Button>
    </div>
  );
}

// ─── Panel shell ──────────────────────────────────────────────────────────────

export function RebalancingPanel({
  transactionId,
  description,
  rebalancingGroupId,
  rebalancingRole,
  onClose,
}: RebalancingPanelProps) {
  const isInGroup = rebalancingGroupId !== null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-surface border-l border-border-base shadow-xl overflow-y-auto z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border-subtle">
        <h2 className="text-sm font-medium text-content-primary">
          {isInGroup ? 'Rebalancing group' : 'Add to group'}
        </h2>
        <button
          onClick={onClose}
          className="shrink-0 text-content-muted hover:text-content-secondary text-sm"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-4 flex-1">
        <p
          className="text-xs text-content-muted truncate"
          title={description}
        >
          {description}
        </p>

        {isInGroup ? (
          <RemoveFromGroupSection
            transactionId={transactionId}
            groupId={rebalancingGroupId}
            role={rebalancingRole ?? 'source'}
            onClose={onClose}
          />
        ) : (
          <AddToGroupSection
            transactionId={transactionId}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
