import { eq } from 'drizzle-orm';
import { SeedError, SeedErrorCode } from './seed.errors';
import { accounts } from '@/db/schema';
import { db } from '@/db';
import { seedSampleAccounts } from '@/db/seeders/sample-accounts';
import { seedSampleTransactions } from '@/db/seeders/sample-transactions';
import { seedSampleAnticipatedBudget } from '@/db/seeders/sample-anticipated-budget';
import { seedSampleRebalancingGroups } from '@/db/seeders/sample-rebalancing-groups';

// Necessary so the data seeded is the staging data. Not the best approach but lets me re-use
// the seeding scripts. Also, would be better to check the environment and load that way
const ENV = "staging"

export async function loadSampleData(userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (existing) {
    throw new SeedError(SeedErrorCode.ACCOUNTS_EXIST);
  }

await db.transaction(async (tx) => {
  const accountIds = await seedSampleAccounts(userId, ENV, tx);
  await seedSampleTransactions(userId, ENV, accountIds, tx);
  await seedSampleAnticipatedBudget(userId, ENV, tx);
  await seedSampleRebalancingGroups(userId, ENV, tx);
});

}
