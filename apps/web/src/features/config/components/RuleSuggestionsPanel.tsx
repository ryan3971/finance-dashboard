import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { RuleEditModal, type InitialFormValues } from './RuleEditModal';
import { useAcceptSuggestion, useDismissSuggestion } from '../hooks/useRuleSuggestions';
import type { RuleSuggestion, AcceptSuggestionInput } from '@finance/shared/types/rule-suggestions';
import type { CreateRuleInput, PatchRuleInput } from '@finance/shared/schemas/rules';
import { RULE_PRIORITY_DEFAULT } from '@finance/shared/constants';
import { cn } from '@/lib/utils';

interface Props {
  readonly suggestions: RuleSuggestion[];
}

function NeedWantBadge({ value }: { readonly value: RuleSuggestion['needWant'] }) {
  if (!value || value === 'NA') return null;
  return (
    <Badge variant={value === 'Need' ? 'info' : 'accent'} className="text-xs">
      {value}
    </Badge>
  );
}

function SuggestionRow({ suggestion }: { readonly suggestion: RuleSuggestion }) {
  const [editOpen, setEditOpen] = useState(false);
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();

  const categoryLabel = suggestion.subcategoryName
    ? `${suggestion.categoryName ?? ''} › ${suggestion.subcategoryName}`
    : (suggestion.categoryName ?? '—');

  const categoryMissing = suggestion.categoryId === null;

  function handleAccept() {
    accept.mutate({ id: suggestion.id, input: {} });
  }

  // Called by RuleEditModal as onCreate (isCreate=true since no rule prop is passed).
  // 'NA' from the suggestion is already coerced to null in initialFormValues below.
  async function handleEditAccept(input: CreateRuleInput) {
    const acceptInput: AcceptSuggestionInput = {
      keyword:       input.keyword,
      categoryId:    input.categoryId,
      subcategoryId: input.subcategoryId ?? undefined,
      needWant:      input.needWant === 'NA' ? null : (input.needWant ?? null),
      priority:      input.priority,
      matchType:     input.matchType,
    };
    await accept.mutateAsync({ id: suggestion.id, input: acceptInput });
    setEditOpen(false);
  }

  // Pre-populate the modal from suggestion fields. 'NA' is not a valid modal
  // option (the field only offers Need / Want / —), so it is coerced to null.
  const initialFormValues: InitialFormValues = {
    keyword:       suggestion.suggestedKeyword,
    matchType:     'substring',
    categoryId:    suggestion.categoryId,
    subcategoryId: suggestion.subcategoryId,
    priority:      RULE_PRIORITY_DEFAULT,
    needWant:      suggestion.needWant === 'NA' ? null : (suggestion.needWant ?? null),
    flagForReview: false,
  };

  const isBusy = accept.isPending || dismiss.isPending;

  return (
    <>
      <tr className="border-t border-border-subtle">
        <td className="px-3 py-2 text-sm font-mono text-content-primary">
          {suggestion.suggestedKeyword}
        </td>
        <td className="px-3 py-2 text-sm text-content-secondary">
          {categoryMissing ? (
            <span className="text-warning text-xs">(category removed)</span>
          ) : (
            categoryLabel
          )}
        </td>
        <td className="px-3 py-2">
          <NeedWantBadge value={suggestion.needWant} />
        </td>
        <td className="px-3 py-2 text-sm text-content-secondary font-mono">
          {Math.round(suggestion.confidence * 100)}%
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={isBusy || categoryMissing}
              onClick={handleAccept}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={isBusy}
              onClick={() => setEditOpen(true)}
            >
              Edit &amp; Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-7 text-xs text-danger hover:text-danger')}
              disabled={isBusy}
              onClick={() => dismiss.mutate(suggestion.id)}
            >
              Dismiss
            </Button>
          </div>
        </td>
      </tr>

      {editOpen && (
        <RuleEditModal
          initialValues={initialFormValues}
          onClose={() => setEditOpen(false)}
          onCreate={handleEditAccept}
          onUpdate={(_input: PatchRuleInput) => Promise.resolve()}
        />
      )}
    </>
  );
}

export function RuleSuggestionsPanel({ suggestions }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-surface-subtle transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-content-muted shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-content-muted shrink-0" />
        )}
        <span className="text-sm font-medium text-content-primary">
          Suggested rules
        </span>
        <span className="ml-1 text-sm text-content-muted">({suggestions.length})</span>
      </button>

      {!collapsed && (
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
                  Need / Want
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-content-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <SuggestionRow key={s.id} suggestion={s} />
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
