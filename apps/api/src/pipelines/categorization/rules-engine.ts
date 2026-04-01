import { desc, eq, isNull, or } from 'drizzle-orm';
import type { CategorizationResult } from './pipeline.types';
import { categorizationRules } from '@/db/schema';
import { db } from '@/db';

export async function runRulesEngine(
  description: string,
  userId: string | null
): Promise<CategorizationResult | null> {
  const conditions = userId
    ? or(
        eq(categorizationRules.userId, userId),
        isNull(categorizationRules.userId)
      )
    : isNull(categorizationRules.userId);

  const rules = await db
    .select()
    .from(categorizationRules)
    .where(conditions)
    .orderBy(desc(categorizationRules.priority));

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
