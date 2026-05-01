import { db } from '@/db';
import { SeedError, SeedErrorCode } from './seed.errors';
import {
  hasAccounts,
  insertSeedAccounts,
  insertSeedBudgetEntries,
  insertSeedRebalancingGroups,
  insertSeedTransactions,
} from './seed.repository';
import { loadRules } from '@/pipelines/categorization/pipeline';
import { detectTransfers } from '@/pipelines/transfer-detection/transfer-detection.service';

export async function loadSampleData(userId: string): Promise<void> {
  if (await hasAccounts(userId)) {
    throw new SeedError(SeedErrorCode.ACCOUNTS_EXIST);
  }

  const rules = await loadRules(userId);

  // detectTransfers calls db.transaction() internally, so it must run after
  // our transaction commits — not nested inside it.
  const transactionIds = await db.transaction(async (tx) => {
    const accountIds = await insertSeedAccounts(userId, tx);
    const { txIdByKey, transactionIds: ids } = await insertSeedTransactions(userId, accountIds, rules, tx);
    await insertSeedBudgetEntries(userId, tx);
    await insertSeedRebalancingGroups(userId, txIdByKey, tx);
    return ids;
  });

  await detectTransfers(transactionIds, userId);
}
