import { db } from '@/db';
import { SeedError, SeedErrorCode } from './seed.errors';
import {
  hasAccounts,
  insertSeedAccounts,
  insertSeedBudgetEntries,
  insertSeedCategories,
  insertSeedContributionRecords,
  insertSeedInvestmentTransactions,
  insertSeedRebalancingGroups,
  insertSeedRules,
  insertSeedTags,
  insertSeedTransactions,
  insertSeedUserConfig,
} from './seed.repository';
import { loadRules } from '@/pipelines/categorization/pipeline';
import { detectTransfers } from '@/pipelines/transfer-detection/transfer-detection.service';

export async function loadSampleData(userId: string): Promise<void> {
  if (await hasAccounts(userId)) {
    throw new SeedError(SeedErrorCode.ACCOUNTS_EXIST);
  }

  // Insert staging categories and rules as user-level data so the seed endpoint
  // is self-contained and does not require a prior CLI seed run.
  // These run outside the main transaction so they are committed before loadRules
  // reads them, and are idempotent so a retry after a failed main transaction is safe.
  await insertSeedCategories(userId);
  await insertSeedRules(userId);

  const rules = await loadRules(userId);

  // detectTransfers calls db.transaction() internally, so it must run after
  // our transaction commits — not nested inside it.
  const transactionIds = await db.transaction(async (tx) => {
    const accountIds = await insertSeedAccounts(userId, tx);
    const { txIdByKey, transactionIds: ids } = await insertSeedTransactions(userId, accountIds, rules, tx);
    await insertSeedBudgetEntries(userId, tx);
    await insertSeedRebalancingGroups(userId, txIdByKey, tx);
    await insertSeedUserConfig(userId, tx);
    await insertSeedTags(userId, txIdByKey, tx);
    await insertSeedInvestmentTransactions(accountIds, tx);
    await insertSeedContributionRecords(accountIds, tx);
    return ids;
  });

  await detectTransfers(transactionIds, userId);
}
