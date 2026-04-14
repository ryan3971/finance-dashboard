import { imports } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { randomUUID } from 'crypto';

interface ImportRow {
  id: string;
  userId: string;
  accountId: string;
  filename: string;
  s3Key: string;
  status: string;
  rowCount: number | null;
  importedCount: number | null;
  duplicateCount: number | null;
  flaggedCount: number | null;
  errorCount: number | null;
  errorDetail: unknown;
  createdAt: Date;
}

/**
 * Insert an import row and return the full inserted record.
 *
 * Both `userId` and `accountId` are required because every import record
 * references a specific user and account.
 * All other fields default to a completed import with zero counts and can be
 * selectively overridden via the third argument.
 *
 * Usage:
 *   const imp = await importFixture(user.id, account.id);
 *   const pending = await importFixture(user.id, account.id, { status: 'pending' });
 */
export async function importFixture(
  userId: string,
  accountId: string,
  overrides: Partial<ImportRow> = {}
): Promise<ImportRow> {
  const key = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(imports)
    .values({
      userId,
      accountId,
      filename: `test-${key}.csv`,
      s3Key: `uploads/test-${key}.csv`,
      status: 'completed',
      rowCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      flaggedCount: 0,
      errorCount: 0,
      errorDetail: null,
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected import insert to return a row');
  return row;
}
