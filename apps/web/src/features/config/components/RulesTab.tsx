import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDeleteRule, useRules, useUpdateRule } from '../hooks/useRules';
import { FIELD_LIMITS, NEED_WANT_OPTIONS, type NeedWant } from '@finance/shared/constants';
import type { Rule } from '@finance/shared/types/rules';

function exportRulesCsv(rules: Rule[]) {
  const header = 'keyword,category,subcategory,priority,needWant';
  const rows = rules.map((r) =>
    [
      r.keyword,
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

function RuleRow({ rule }: { readonly rule: Rule }) {
  const [editing, setEditing] = useState(false);
  const [keyword, setKeyword] = useState(rule.keyword);
  const [priority, setPriority] = useState(String(rule.priority));
  const [needWant, setNeedWant] = useState<NeedWant | ''>(rule.needWant ?? '');
  const update = useUpdateRule();
  const remove = useDeleteRule();

  const categoryWithSub = rule.subcategoryName
    ? `${rule.categoryName} › ${rule.subcategoryName}`
    : rule.categoryName;
  const categoryLabel = rule.categoryName ? categoryWithSub : '—';

  const parsedPriority = parseInt(priority, 10);

  function handleSave() {
    update.mutate(
      {
        id: rule.id,
        input: {
          keyword: keyword.trim(),
          priority: parsedPriority,
          needWant: needWant || null,
        },
      },
      { onSuccess: () => setEditing(false) }
    );
  }

  function handleCancel() {
    setKeyword(rule.keyword);
    setPriority(String(rule.priority));
    setNeedWant(rule.needWant ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-t border-border-subtle">
        <td className="px-3 py-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            maxLength={FIELD_LIMITS.RULE_KEYWORD_MAX}
            className="h-7 text-sm w-full"
            autoFocus
          />
        </td>
        <td className="px-3 py-2 text-sm text-content-secondary">
          {categoryLabel}
        </td>
        <td className="px-3 py-2">
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-7 text-sm w-16"
          />
        </td>
        <td className="px-3 py-2">
          <select
            value={needWant}
            onChange={(e) => setNeedWant(e.target.value as NeedWant | '')}
            className="h-7 text-sm border border-border-base rounded px-1"
          >
            <option value="">—</option>
            {NEED_WANT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={
                !keyword.trim() || isNaN(parsedPriority) || update.isPending
              }
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border-subtle group">
      <td className="px-3 py-2 text-sm font-mono text-content-primary">
        {rule.keyword}
      </td>
      <td className="px-3 py-2 text-sm text-content-secondary">
        {categoryLabel}
      </td>
      <td className="px-3 py-2 text-sm text-content-secondary">
        {rule.priority}
      </td>
      <td className="px-3 py-2 text-sm text-content-secondary">
        {rule.needWant ?? '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-danger hover:text-danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate(rule.id)}
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

const RULE_SKELETON_ROW_COUNT = 5;

export function RulesTab() {
  const { data: rules, isLoading, isError } = useRules();

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: RULE_SKELETON_ROW_COUNT }, (_, i) => `skeleton-${i}`).map((id) => (
          <Skeleton key={id} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError)
    return <EmptyState message="Failed to load rules." variant="error" />;

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={!rules || rules.length === 0}
          onClick={() => rules && exportRulesCsv(rules)}
        >
          Export CSV
        </Button>
      </div>

      {!rules || rules.length === 0 ? (
        <EmptyState
          message="No rules yet."
          hint="Rules are created automatically when you categorise transactions during import review."
        />
      ) : (
        <div className="bg-white rounded border border-border-base overflow-hidden">
          <table className="w-full text-left">
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
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
