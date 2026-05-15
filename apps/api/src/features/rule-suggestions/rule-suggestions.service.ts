import { alias } from 'drizzle-orm/pg-core';
import { categories, ruleSuggestions } from '@/db/schema';
import { db } from '@/db';
import { and, desc, eq } from 'drizzle-orm';
import { createRule } from '@/features/categorization-rules/categorization-rules.service';
import { AUTO_RULE_PRIORITY } from '@/lib/constants';
import type { AcceptSuggestionInput } from '@finance/shared/types/rule-suggestions';
import { RuleSuggestionError, RuleSuggestionErrorCode } from './rule-suggestions.errors';

const cat = alias(categories, 'cat');
const subcat = alias(categories, 'subcat');

function suggestionSelect(conn: typeof db = db) {
  return conn
    .select({
      id:               ruleSuggestions.id,
      suggestedKeyword: ruleSuggestions.suggestedKeyword,
      categoryId:       ruleSuggestions.categoryId,
      categoryName:     cat.name,
      subcategoryId:    ruleSuggestions.subcategoryId,
      subcategoryName:  subcat.name,
      needWant:         ruleSuggestions.needWant,
      confidence:       ruleSuggestions.confidence,
      transactionId:    ruleSuggestions.transactionId,
      status:           ruleSuggestions.status,
      createdAt:        ruleSuggestions.createdAt,
    })
    .from(ruleSuggestions)
    .leftJoin(cat, eq(ruleSuggestions.categoryId, cat.id))
    .leftJoin(subcat, eq(ruleSuggestions.subcategoryId, subcat.id));
}

async function fetchOwnedSuggestion(id: string, userId: string) {
  const [row] = await db
    .select({
      id:               ruleSuggestions.id,
      userId:           ruleSuggestions.userId,
      suggestedKeyword: ruleSuggestions.suggestedKeyword,
      categoryId:       ruleSuggestions.categoryId,
      subcategoryId:    ruleSuggestions.subcategoryId,
      needWant:         ruleSuggestions.needWant,
      status:           ruleSuggestions.status,
    })
    .from(ruleSuggestions)
    .where(eq(ruleSuggestions.id, id))
    .limit(1);

  if (!row) throw new RuleSuggestionError(RuleSuggestionErrorCode.NOT_FOUND);
  if (row.userId !== userId) throw new RuleSuggestionError(RuleSuggestionErrorCode.FORBIDDEN);
  return row;
}

export async function listPendingSuggestions(userId: string) {
  return suggestionSelect()
    .where(
      and(
        eq(ruleSuggestions.userId, userId),
        eq(ruleSuggestions.status, 'pending')
      )
    )
    .orderBy(desc(ruleSuggestions.confidence), desc(ruleSuggestions.createdAt));
}

export async function acceptSuggestion(
  id: string,
  userId: string,
  input: AcceptSuggestionInput
) {
  return db.transaction(async (tx) => {
    const suggestion = await fetchOwnedSuggestion(id, userId);

    if (suggestion.status !== 'pending') {
      throw new RuleSuggestionError(RuleSuggestionErrorCode.ALREADY_ACTIONED);
    }

    // Resolve needWant: body override takes precedence; coerce 'NA' → null from either source.
    let resolvedNeedWant: 'Need' | 'Want' | null;
    if (input.needWant !== undefined) {
      resolvedNeedWant = input.needWant;
    } else {
      const stored = suggestion.needWant;
      resolvedNeedWant = stored === 'Need' || stored === 'Want' ? stored : null;
    }

    const rule = await createRule(
      userId,
      {
        keyword:       input.keyword       ?? suggestion.suggestedKeyword,
        categoryId:    input.categoryId    !== undefined ? input.categoryId    : suggestion.categoryId,
        subcategoryId: input.subcategoryId !== undefined ? input.subcategoryId : suggestion.subcategoryId,
        needWant:      resolvedNeedWant,
        priority:      input.priority  ?? AUTO_RULE_PRIORITY,
        matchType:     input.matchType ?? 'substring',
        flagForReview: false,
        sourceName:    suggestion.suggestedKeyword,
      },
      tx
    );

    await tx
      .update(ruleSuggestions)
      .set({ status: 'accepted' })
      .where(eq(ruleSuggestions.id, id));

    return rule;
  });
}

export async function dismissSuggestion(id: string, userId: string) {
  const suggestion = await fetchOwnedSuggestion(id, userId);

  if (suggestion.status !== 'pending') {
    throw new RuleSuggestionError(RuleSuggestionErrorCode.ALREADY_ACTIONED);
  }

  await db
    .update(ruleSuggestions)
    .set({ status: 'dismissed' })
    .where(eq(ruleSuggestions.id, id));
}
