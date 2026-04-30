import * as fs from 'fs';
import * as path from 'path';
import type { AccountType, Institution } from '@finance/shared/constants';
import { SeedError, SeedErrorCode } from './seed.errors';
import { accounts } from '@/db/schema';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { processImport } from '@/features/imports/import.service';
import { seedStagingAnticipatedBudget } from '@/db/staging/seed-anticipated-budget';
import { seedStagingRebalancingGroups } from '@/db/staging/seed-rebalancing-groups';
import { STAGING_ACCOUNTS } from '@/db/staging/data/accounts';

const FIXTURE_CSV_DIR = path.join(__dirname, '../../../db/staging/csv');

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
    for (const entry of STAGING_ACCOUNTS) {
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

    await seedStagingAnticipatedBudget(userId);
    await seedStagingRebalancingGroups(userId);
  } catch (err) {
    // Compensating rollback — FK cascades clean up transactions and imports.
    await db.delete(accounts).where(eq(accounts.userId, userId));
    throw err;
  }
}
