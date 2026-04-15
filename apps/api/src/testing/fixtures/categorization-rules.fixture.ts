import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { categorizationRules } from '@/db/schema';

interface CategorizationRuleRow {
  id: string;
  userId: string | null;
  keyword: string;
  sourceName: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: 'Need' | 'Want' | 'NA' | 'ADD' | null;
  priority: number;
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
      priority: 0,
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected categorization rule insert to return a row');
  return row;
}
