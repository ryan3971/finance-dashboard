import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { ruleSuggestions } from '@/db/schema';

interface RuleSuggestionRow {
  id: string;
  userId: string;
  suggestedKeyword: string;
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: string | null;
  confidence: string;
  transactionId: string | null;
  status: string;
  createdAt: Date;
}

/**
 * Insert a rule_suggestion row and return the full inserted record.
 *
 * Defaults to a pending suggestion with 85% confidence and no category.
 * Pass overrides to customise keyword, category, status, etc.
 */
export async function ruleSuggestionFixture(
  overrides: Partial<Omit<RuleSuggestionRow, 'userId'>> & Pick<RuleSuggestionRow, 'userId'>
): Promise<RuleSuggestionRow> {
  const [row] = await db
    .insert(ruleSuggestions)
    .values({
      suggestedKeyword: 'amazon',
      categoryId:       null,
      subcategoryId:    null,
      needWant:         null,
      confidence:       '0.850',
      transactionId:    null,
      status:           'pending',
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected rule suggestion insert to return a row');
  return row as RuleSuggestionRow;
}
