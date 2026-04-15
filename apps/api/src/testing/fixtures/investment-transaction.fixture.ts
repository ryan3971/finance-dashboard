import { randomUUID } from 'crypto';
import { investmentTransactions } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';

/**
 * Insert an investment transaction row and return the full inserted record.
 *
 * `accountId` is required because every investment transaction must belong to
 * an account. A unique `compositeKey` is generated automatically unless
 * overridden. All other fields default to a cash deposit contribution and can
 * be selectively overridden via the second argument.
 *
 * Usage:
 *   const contrib = await investmentTransactionFixture(account.id);
 *   const buy     = await investmentTransactionFixture(account.id, {
 *                     action: 'buy',
 *                     rawAction: 'Buy',
 *                     symbol: 'VFV',
 *                     quantity: '10.000000',
 *                     price: '120.0000',
 *                     amount: '-1200.00',
 *                   });
 */
export async function investmentTransactionFixture(
  accountId: string,
  overrides: Partial<typeof investmentTransactions.$inferInsert> = {}
): Promise<typeof investmentTransactions.$inferSelect> {
  const key = randomUUID();
  const [row] = await db
    .insert(investmentTransactions)
    .values({
      accountId,
      date: '2024-01-15',
      action: 'deposit',
      rawAction: 'CON',
      symbol: null,
      description: 'Test Contribution',
      quantity: null,
      price: null,
      grossAmount: null,
      commission: null,
      amount: '100.00',
      currency: 'CAD',
      riskLevel: null,
      activityType: null,
      compositeKey: key,
      note: null,
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected investment transaction insert to return a row');
  return row;
}
