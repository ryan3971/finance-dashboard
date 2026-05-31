import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { DataTable } from '@/components/ui/DataTable';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useCreateRule, useDeleteRule, useReapplyRule, useRules, useUpdateRule } from '../hooks/useRules';
import { useRuleSuggestions } from '../hooks/useRuleSuggestions';
import type { CreateRuleInput, PatchRuleInput } from '@finance/shared/schemas/rules';
import type { Rule } from '@finance/shared/types/rules';
import { RuleEditModal } from './RuleEditModal';
import { RuleSuggestionsPanel } from './RuleSuggestionsPanel';

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey =
  | 'keyword-asc'
  | 'keyword-desc'
  | 'category-asc'
  | 'priority-desc'
  | 'priority-asc'
  | 'date-desc'
  | 'date-asc';

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportRulesCsv(rules: Rule[]) {
  const header = 'keyword,matchType,category,subcategory,priority,needWant';
  const rows = rules.map((r) =>
    [
      r.keyword,
      r.matchType,
      r.categoryName ?? '',
      r.subcategoryName ?? '',
      r.priority,
      r.needWant ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'categorization-rules.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

function sortRules(rules: Rule[], key: SortKey): Rule[] {
  return [...rules].sort((a, b) => {
    switch (key) {
      case 'keyword-asc':
        return a.keyword.localeCompare(b.keyword);
      case 'keyword-desc':
        return b.keyword.localeCompare(a.keyword);
      case 'category-asc':
        return (a.categoryName ?? '').localeCompare(b.categoryName ?? '');
      case 'priority-desc':
        return b.priority - a.priority;
      case 'priority-asc':
        return a.priority - b.priority;
      case 'date-desc':
        return b.createdAt.localeCompare(a.createdAt);
      case 'date-asc':
        return a.createdAt.localeCompare(b.createdAt);
    }
  });
}

// ─── RuleRow ─────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onEdit,
}: {
  readonly rule: Rule;
  readonly onEdit: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteRule();

  const categoryLabel = rule.subcategoryName
    ? `${rule.categoryName} › ${rule.subcategoryName}`
    : (rule.categoryName ?? '—');

  return (
    <tr className="border-t border-border-subtle group">
      <td className="px-3 py-2 text-sm font-mono text-content-primary">
        <span>{rule.keyword}</span>
        {rule.matchType === 'wildcard' && (
          <Badge variant="neutral" className="ml-2 text-xs rounded px-1.5 py-0">
            W
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-content-secondary">{categoryLabel}</td>
      <td className="px-3 py-2 text-sm text-content-secondary">{rule.priority}</td>
      <td className="px-3 py-2 text-sm text-content-secondary">
        {rule.flagForReview ? (
          <span className="text-xs font-medium text-warning">Flag for review</span>
        ) : (
          rule.needWant ?? '—'
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-danger hover:text-danger"
            disabled={remove.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </div>
      </td>
      <DeleteConfirmDialog
        open={confirmDelete}
        title="Delete rule?"
        description={`The rule matching "${rule.keyword}" will be permanently deleted.`}
        isPending={remove.isPending}
        onConfirm={() => remove.mutate(rule.id, { onSuccess: () => setConfirmDelete(false) })}
        onCancel={() => setConfirmDelete(false)}
      />
    </tr>
  );
}

// ─── RulesTable ───────────────────────────────────────────────────────────────

function RulesTable({
  rules,
  onEdit,
}: {
  readonly rules: Rule[];
  readonly onEdit: (rule: Rule) => void;
}) {
  return (
    <DataTable>
      <table className="min-w-full text-left">
        <thead>
          <tr className="bg-surface-muted">
            <th className="px-3 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider">
              Keyword
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider">
              Category
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider">
              Priority
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider">
              Need/Want
            </th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onEdit={() => onEdit(rule)} />
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

// ─── CategoryGroup ────────────────────────────────────────────────────────────

function CategoryGroup({
  label,
  rules,
  onEdit,
}: {
  readonly label: string;
  readonly rules: Rule[];
  readonly onEdit: (rule: Rule) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1.5 w-full text-left px-1 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider hover:text-content-secondary"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {label}
        <span className="ml-1 font-normal normal-case text-content-muted">({rules.length})</span>
      </button>
      {!collapsed && <RulesTable rules={rules} onEdit={onEdit} />}
    </div>
  );
}

// ─── RulesTab ─────────────────────────────────────────────────────────────────

const RULE_SKELETON_ROW_COUNT = 5;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'priority-desc', label: 'Priority ↑ (default)' },
  { value: 'priority-asc', label: 'Priority ↓' },
  { value: 'keyword-asc', label: 'Keyword A–Z' },
  { value: 'keyword-desc', label: 'Keyword Z–A' },
  { value: 'category-asc', label: 'Category A–Z' },
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
];

export function RulesTab() {
  const { data: suggestions = [] } = useRuleSuggestions();
  const { data: rules, isPending, isError } = useRules();
  const showSkeleton = useDelayedPending(isPending);
  const update = useUpdateRule();
  const create = useCreateRule();
  const reapply = useReapplyRule();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority-desc');
  const [groupByCategory, setGroupByCategory] = useState(false);
  // null = closed, 'create' = creating new, Rule = editing that rule
  const [modalState, setModalState] = useState<null | 'create' | Rule>(null);
  // rule ID awaiting reapply confirmation after an edit
  const [reapplyRuleId, setReapplyRuleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!rules) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.keyword.toLowerCase().includes(q) ||
        (r.categoryName ?? '').toLowerCase().includes(q) ||
        (r.subcategoryName ?? '').toLowerCase().includes(q)
    );
  }, [rules, search]);

  const sorted = useMemo(() => sortRules(filtered, sortKey), [filtered, sortKey]);

  const groups = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, Rule[]>();
    for (const rule of sorted) {
      const key = rule.categoryName ?? 'Uncategorized';
      const existing = map.get(key);
      if (existing) {
        existing.push(rule);
      } else {
        map.set(key, [rule]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [sorted, groupByCategory]);

  function openCreate() {
    setModalState('create');
  }

  function openEdit(rule: Rule) {
    setModalState(rule);
  }

  function closeModal() {
    setModalState(null);
  }

  async function handleCreate(input: CreateRuleInput) {
    await create.mutateAsync(input);
    closeModal();
  }

  async function handleUpdate(input: PatchRuleInput) {
    if (modalState === null || modalState === 'create') return;
    const original = modalState;
    await update.mutateAsync({ id: original.id, input });
    closeModal();

    const categoryChanged =
      (input.categoryId !== undefined && input.categoryId !== original.categoryId) ||
      (input.subcategoryId !== undefined && input.subcategoryId !== original.subcategoryId) ||
      (input.needWant !== undefined && input.needWant !== original.needWant) ||
      (input.flagForReview !== undefined && input.flagForReview !== original.flagForReview);
    if (categoryChanged) {
      setReapplyRuleId(original.id);
    }
  }

  if (showSkeleton) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: RULE_SKELETON_ROW_COUNT }, (_, i) => `skeleton-${i}`).map((id) => (
          <Skeleton key={id} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isPending) return null;

  if (isError) return <EmptyState message="Failed to load rules." variant="error" />;

  const ruleCount = rules.length;
  const filteredCount = sorted.length;

  let content;
  if (sorted.length === 0) {
    content = search ? (
      <EmptyState message="No rules match your search." />
    ) : (
      <EmptyState
        message="No rules yet."
        hint="Rules are created automatically when you categorise transactions during import review."
      />
    );
  } else if (groupByCategory && groups) {
    content = (
      <div className="space-y-4">
        {groups.map(([label, groupRules]) => (
          <CategoryGroup key={label} label={label} rules={groupRules} onEdit={openEdit} />
        ))}
      </div>
    );
  } else {
    content = <RulesTable rules={sorted} onEdit={openEdit} />;
  }

  return (
    <div className="mt-4 space-y-4">
      {suggestions.length > 0 && <RuleSuggestionsPanel suggestions={suggestions} />}

      <div className="space-y-3">
      {/* Row 1: search + primary action */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-muted pointer-events-none" />
          <Input
            placeholder="Search rules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button size="sm" className="shrink-0 flex items-center h-8" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add rule
        </Button>
      </div>

      {/* Row 2: view controls + count + export */}
      <div className="flex items-center gap-2">
        <select
          value={sortKey}
          onChange={(e) => {
            const v = e.target.value;
            if (SORT_OPTIONS.some((o) => o.value === v)) setSortKey(v as SortKey);
          }}
          className="select-base h-8 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant={groupByCategory ? 'primary' : 'secondary'}
          onClick={() => setGroupByCategory((g) => !g)}
        >
          Group by category
        </Button>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-sm text-content-muted">
            {search && filteredCount !== ruleCount
              ? `${filteredCount} of ${ruleCount} rules`
              : `${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'}`}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={sorted.length === 0}
            onClick={() => exportRulesCsv(sorted)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      {content}
      </div>

      {/* Modal */}
      {modalState !== null && (
        <RuleEditModal
          rule={modalState === 'create' ? undefined : modalState}
          onClose={closeModal}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}

      {/* Reapply confirmation */}
      {reapplyRuleId !== null && (
        <Dialog open onOpenChange={(open) => { if (!open) setReapplyRuleId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Apply rule to transactions?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-content-secondary">
              Apply the updated categorization to all matching transactions, including those
              already categorized by a rule? Your manual categorizations won't be changed.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReapplyRuleId(null)}
                disabled={reapply.isPending}
              >
                Skip
              </Button>
              <Button
                type="button"
                disabled={reapply.isPending}
                onClick={() => {
                  reapply.mutate(reapplyRuleId, { onSettled: () => setReapplyRuleId(null) });
                }}
              >
                {reapply.isPending ? 'Applying…' : 'Apply'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
