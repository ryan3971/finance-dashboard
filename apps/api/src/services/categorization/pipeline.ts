import { db } from '../../db';
import { categories } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { runRulesEngine } from './rules-engine';
import type { CategorizationResult } from './pipeline.types';

let uncategorizedId: string | null = null;

async function getUncategorizedId(): Promise<string> {
  if (uncategorizedId) return uncategorizedId;

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(isNull(categories.userId), eq(categories.name, 'Uncategorized')))
    .limit(1);

  if (!cat) throw new Error('Uncategorized system category not found. Run db:seed first.');

  uncategorizedId = cat.id;
  return cat.id;
}

export async function categorize(
  description: string,
  userId: string
): Promise<CategorizationResult> {
  const ruleResult = await runRulesEngine(description, userId);
  if (ruleResult) return ruleResult;

  const fallbackId = await getUncategorizedId();
  return {
    categoryId: fallbackId,
    subcategoryId: null,
    needWant: null,
    categorySource: 'default',
    categoryConfidence: 0,
    sourceName: null,
    flaggedForReview: true,
  };
}
