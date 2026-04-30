import { and, eq } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db as defaultDb } from '@/db';
import {
  accounts,
  rebalancingGroupTransactions,
  rebalancingGroups,
  transactions,
} from '@/db/schema';
import { STAGING_REBALANCING_GROUPS } from '@/db/seeds/staging/rebalancing-groups';
import { TEST_REBALANCING_GROUPS } from '@/db/seeds/test/rebalancing-groups';
import type { SeedEnv } from './system-categories';

type DbLike = typeof defaultDb;

function getGroupsData(env: SeedEnv) {
  if (env === 'staging') return STAGING_REBALANCING_GROUPS;
  return TEST_REBALANCING_GROUPS;
}

export async function seedSampleRebalancingGroups(
  userId: string,
  env: SeedEnv,
  db: DbLike = defaultDb
): Promise<void> {
  const data = getGroupsData(env);

  const accountRows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const accountIdByName = new Map(accountRows.map((r) => [r.name, r.id]));

  for (const group of data) {
    const resolvedIds: { id: string; role: 'source' | 'offset' }[] = [];

    for (const txDef of group.transactions) {
      const accountId = accountIdByName.get(txDef.accountName);
      assertDefined(accountId, `No account found for name '${txDef.accountName}'`);

      const [tx] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, accountId),
            eq(transactions.description, txDef.description)
          )
        )
        .limit(1);

      assertDefined(
        tx,
        `No transaction found: account '${txDef.accountName}', description '${txDef.description}'`
      );

      resolvedIds.push({ id: tx.id, role: txDef.role });
    }

    const [inserted] = await db
      .insert(rebalancingGroups)
      .values({
        userId,
        label: group.label,
        status: group.status,
        myShareOverride:
          group.myShareOverride !== null ? String(group.myShareOverride) : null,
        flaggedForReview: group.flaggedForReview,
      })
      .returning({ id: rebalancingGroups.id });

    assertDefined(
      inserted,
      `Expected insert for group '${group.label}' to return a row`
    );

    for (const { id: transactionId, role } of resolvedIds) {
      await db.insert(rebalancingGroupTransactions).values({
        groupId: inserted.id,
        transactionId,
        role,
      });
    }
  }
}

export async function clearSampleRebalancingGroups(
  userId: string,
  db: DbLike = defaultDb
): Promise<void> {
  await db
    .delete(rebalancingGroups)
    .where(eq(rebalancingGroups.userId, userId));
}
