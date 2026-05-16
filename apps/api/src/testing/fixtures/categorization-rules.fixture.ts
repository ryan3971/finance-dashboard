import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { categorizationRules } from '@/db/schema';
import { trackSystemRuleForCleanup } from '@/testing/test-helpers';

interface CategorizationRuleRow {
  id: string;
  userId: string | null;
  keyword: string;
  sourceName: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: 'Need' | 'Want' | 'NA' | null;
  flagForReview: boolean;
  priority: number;
  matchType: 'substring' | 'wildcard';
  createdAt: Date;
}

/**
 * Insert a categorization rule row and return the full inserted record.
 *
 * Defaults to a system-level rule (userId: null) matching keyword 'amazon'
 * with no category, subcategory, need/want, or source name assignments.
 * Pass `userId` to create a user-owned rule.
 *
 * Usage:
 *   const rule = await categorizationRuleFixture({ userId: user.id, keyword: 'netflix' });
 *   const sys  = await categorizationRuleFixture({ userId: null, keyword: 'amazon' });
 */
export async function categorizationRuleFixture(
  overrides: Partial<CategorizationRuleRow> = {}
): Promise<CategorizationRuleRow> {
  const [row] = await db
    .insert(categorizationRules)
    .values({
      userId: null,
      keyword: 'amazon',
      sourceName: null,
      categoryId: null,
      subcategoryId: null,
      needWant: null,
      flagForReview: false,
      priority: 0,
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected categorization rule insert to return a row');
  // System rules (userId: null) are not tied to a tracked user, so
  // cleanDatabase() can't reach them via the user cleanup path. Register the
  // ID directly so it gets deleted at the end of the current test.
  if (row.userId === null) {
    trackSystemRuleForCleanup(row.id);
  }
  return row;
}
