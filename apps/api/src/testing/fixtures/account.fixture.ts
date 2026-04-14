import { randomUUID } from 'crypto';
import { accounts } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';

interface AccountRow {
  id: string;
  userId: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isActive: boolean;
  isCredit: boolean;
  createdAt: Date;
}

/**
 * Insert an account row and return the full inserted record.
 *
 * `userId` is required because every account must belong to a user.
 * All other fields default to sensible test values and can be selectively
 * overridden via the second argument.
 *
 * Usage:
 *   const account = await accountFixture(user.id);
 *   const creditCard = await accountFixture(user.id, { isCredit: true, name: 'AMEX' });
 */
export async function accountFixture(
  userId: string,
  overrides: Partial<typeof accounts.$inferInsert> = {}
): Promise<AccountRow> {
  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: `Test Chequing ${randomUUID().slice(0, 8)}`,
      type: 'chequing',
      institution: 'td',
      currency: 'CAD',
      isCredit: false,
      isActive: true,
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected account insert to return a row');
  return row;
}
