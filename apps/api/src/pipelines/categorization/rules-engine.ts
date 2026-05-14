import { CONFIDENCE } from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';
import { desc, eq, isNull, or } from 'drizzle-orm';
import type { CategorizationResult } from './pipeline.types';
import { categorizationRules } from '@/db/schema';
import { db } from '@/db';

export type Rule = typeof categorizationRules.$inferSelect;
export type LoadedRule = Omit<Rule, 'createdAt'>;

/**
 * Fetch all rules applicable to a user (user-specific + global system rules),
 * ordered by priority descending. Call this once before processing a batch of
 * transactions and pass the result to `applyRules` to avoid an N+1 query.
 */
export async function loadRules(userId: string | null): Promise<LoadedRule[]> {
  const conditions = userId
    ? or(eq(categorizationRules.userId, userId), isNull(categorizationRules.userId))
    : isNull(categorizationRules.userId);

  return db
    .select({
      id: categorizationRules.id,
      userId: categorizationRules.userId,
      keyword: categorizationRules.keyword,
      sourceName: categorizationRules.sourceName,
      categoryId: categorizationRules.categoryId,
      subcategoryId: categorizationRules.subcategoryId,
      needWant: categorizationRules.needWant,
      flagForReview: categorizationRules.flagForReview,
      priority: categorizationRules.priority,
      matchType: categorizationRules.matchType,
    })
    .from(categorizationRules)
    .where(conditions)
    .orderBy(desc(categorizationRules.priority));
}

function descriptionMatchesRule(description: string, rule: LoadedRule): boolean {
  const normDesc = description.toLowerCase();
  const normKeyword = rule.keyword.toLowerCase();

  if (rule.matchType === 'wildcard') {
    const escaped = normKeyword.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`).test(normDesc);
  }

  return normDesc.includes(normKeyword);
}

/**
 * Apply a pre-loaded set of rules against a description.
 * Pure function — no DB access. Use with `loadRules` for batch processing.
 */
export function applyRules(
  description: string,
  rules: LoadedRule[]
): CategorizationResult | null {
  for (const rule of rules) {
    if (!descriptionMatchesRule(description, rule)) continue;

    if (rule.flagForReview) {
      return {
        categoryId: null,
        subcategoryId: null,
        needWant: null,
        categorySource: CATEGORY_SOURCE.RULE,
        categoryConfidence: CONFIDENCE.RULE,
        sourceName: rule.sourceName,
        flaggedForReview: true,
      };
    }

    return {
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      needWant: rule.needWant,
      categorySource: CATEGORY_SOURCE.RULE,
      categoryConfidence: CONFIDENCE.RULE,
      sourceName: rule.sourceName,
      flaggedForReview: false,
    };
  }

  return null;
}

/**
 * Convenience wrapper for categorizing a single transaction outside of a batch.
 * Fetches rules on every call — do not use inside loops.
 */
export async function runRulesEngine(
  description: string,
  userId: string | null
): Promise<CategorizationResult | null> {
  const rules = await loadRules(userId);
  return applyRules(description, rules);
}
