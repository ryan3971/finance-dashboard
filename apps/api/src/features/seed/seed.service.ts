import * as fs from 'fs';
import * as path from 'path';
import type { AccountType, Institution } from '@finance/shared/constants';
import { SeedError, SeedErrorCode } from './seed.errors';
import { accounts } from '@/db/schema';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { processImport } from '@/features/imports/import.service';
import { seedTestAnticipatedBudget } from '@/testing/seeders/seed-anticipated-budget';
import { seedTestRebalancingGroups } from '@/testing/seeders/seed-rebalancing-groups';
import { DEV_ACCOUNTS } from '@/testing/seeds/accounts';

const FIXTURE_CSV_DIR = path.join(__dirname, '../../testing/csv');

// Questrade is an investment account (routes to investment_transactions, not
// transactions) so it does not populate any dashboard tab — exclude it.
const FIXTURE_ACCOUNTS = DEV_ACCOUNTS.filter(
  (a) => a.institution !== 'questrade'
);

async function importFixtureCsv(
  userId: string,
  accountId: string,
  filename: string
): Promise<void> {
  const buffer = fs.readFileSync(path.join(FIXTURE_CSV_DIR, filename));
  await processImport(userId, accountId, filename, buffer);
}

export async function loadSampleData(userId: string): Promise<void> {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    throw new SeedError(SeedErrorCode.ACCOUNTS_EXIST);
  }

  try {
    for (const entry of FIXTURE_ACCOUNTS) {
      const [account] = await db
        .insert(accounts)
        .values({
          userId,
          name: entry.name,
          // Fixture data defines known-valid enum literals — cast is safe here.
          type: entry.type as AccountType,
          institution: entry.institution as Institution,
          currency: 'CAD',
          isCredit: entry.isCredit,
        })
        .returning({ id: accounts.id });

      if (!account) throw new Error(`Failed to insert account: ${entry.name}`);

      await importFixtureCsv(userId, account.id, entry.fixture.file);
    }

    await seedTestAnticipatedBudget(userId);
    await seedTestRebalancingGroups(userId);
  } catch (err) {
    // Compensating rollback — FK cascades clean up transactions and imports.
    await db.delete(accounts).where(eq(accounts.userId, userId));
    throw err;
  }
}
