import { CONFIDENCE } from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';
import { desc, eq, isNull } from 'drizzle-orm';
import type { CategorizationResult } from './pipeline.types';
import { categorizationRules } from '@/db/schema';
import { db } from '@/db';

// TODO(hardening): The 'ADD' value in needWant is a sentinel that changes rule
// behaviour entirely (flag-for-review instead of assign category). This couples
// two unrelated concerns in one column. A dedicated boolean `flagForReview`
// column on `categorization_rules` would make the intent explicit and prevent
// accidental misuse of the needWant field.

// TODO(hardening): Keyword matching uses a plain substring check (.includes()),
// so short keywords can produce false positives (e.g. "pay" matching
// "repayment", "visa" matching "supervisor"). Consider storing a `matchType`
// column ('substring' | 'word' | 'regex') and dispatching accordingly, or at
// minimum enforcing word-boundary matching for short keywords.

export type Rule = typeof categorizationRules.$inferSelect;
export type LoadedRule = Omit<Rule, 'createdAt'>;

/**
 * Fetch all rules applicable to a user (user-specific + global system rules),
 * ordered by priority descending. Call this once before processing a batch of
 * transactions and pass the result to `applyRules` to avoid an N+1 query.
 */
export async function loadRules(userId: string | null): Promise<LoadedRule[]> {
  const conditions = userId
    ? eq(categorizationRules.userId, userId)
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
      priority: categorizationRules.priority,
    })
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
  rules: LoadedRule[]
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
