import { desc, eq, isNull, or } from 'drizzle-orm';
import type { CategorizationResult } from './pipeline.types';
import { categorizationRules } from '@/db/schema';
import { db } from '@/db';

export type Rule = typeof categorizationRules.$inferSelect;

/**
 * Fetch all rules applicable to a user (user-specific + global system rules),
 * ordered by priority descending. Call this once before processing a batch of
 * transactions and pass the result to `applyRules` to avoid an N+1 query.
 */
export async function loadRules(userId: string | null): Promise<Rule[]> {
  const conditions = userId
    ? or(
        eq(categorizationRules.userId, userId),
        isNull(categorizationRules.userId)
      )
    : isNull(categorizationRules.userId);

  return db
    .select()
    .from(categorizationRules)
    .where(conditions)
    .orderBy(desc(categorizationRules.priority));
}

/**
 * Apply a pre-loaded set of rules against a description.
 * Pure function — no DB access. Use with `loadRules` for batch processing.
 */
export function applyRules(
  description: string,
  rules: Rule[]
): CategorizationResult | null {
  const normalisedDesc = description.toLowerCase();

  for (const rule of rules) {
    if (!normalisedDesc.includes(rule.keyword.toLowerCase())) continue;

    // ADD sentinel: flag for review, do not assign category
    if (rule.needWant === 'ADD') {
      return {
        categoryId: null,
        subcategoryId: null,
        needWant: null,
        categorySource: 'rule',
        categoryConfidence: 1.0,
        sourceName: rule.sourceName,
        flaggedForReview: true,
      };
    }

    return {
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      needWant: rule.needWant as 'Need' | 'Want' | 'NA' | null,
      categorySource: 'rule',
      categoryConfidence: 1.0,
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
