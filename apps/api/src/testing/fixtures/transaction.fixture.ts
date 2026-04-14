import { randomUUID } from 'crypto';
import { transactions } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';

interface TransactionRow {
  id: string;
  accountId: string;
  importId: string | null;
  date: string;
  description: string;
  rawDescription: string;
  sourceName: string | null;
  amount: string;
  currency: string;
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: string | null;
  categorySource: string | null;
  categoryConfidence: string | null;
  isTransfer: boolean;
  transferPairId: string | null;
  isIncome: boolean;
  flaggedForReview: boolean;
  compositeKey: string;
  note: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Insert a transaction row and return the full inserted record. THi is used instead of an endpoint for full control over the transaction fields.
 *
 * `accountId` is required because every transaction must belong to an account.
 * A unique `compositeKey` is generated automatically unless overridden.
 * All other fields default to a plain expense transaction and can be
 * selectively overridden via the second argument.
 *
 * Usage:
 *   const tx      = await transactionFixture(account.id);
 *   const income  = await transactionFixture(account.id, { isIncome: true, amount: '3000.00' });
 *   const need    = await transactionFixture(account.id, {
 *                     amount: '-50.00',
 *                     needWant: 'Need',
 *                     categoryId: groceriesId,
 *                   });
 */

export async function transactionFixture(
  accountId: string,
  overrides: Partial<TransactionRow> = {}
): Promise<TransactionRow> {
  const key = randomUUID();
  const [row] = await db
    .insert(transactions)
    .values({
      accountId,
      date: '2024-01-15',
      description: 'Test Transaction',
      rawDescription: 'TEST TRANSACTION',
      sourceName: null,
      amount: '-10.00',
      currency: 'CAD',
      categoryId: null,
      subcategoryId: null,
      needWant: null,
      categorySource: null,
      categoryConfidence: null,
      isTransfer: false,
      transferPairId: null,
      isIncome: false,
      flaggedForReview: false,
      compositeKey: key,
      note: null,
      source: 'manual',
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected transaction insert to return a row');
  return row;
}
