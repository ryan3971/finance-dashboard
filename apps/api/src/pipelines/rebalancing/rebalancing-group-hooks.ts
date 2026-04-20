import { and, eq, sql } from 'drizzle-orm';
import {
  rebalancingGroupTransactions,
  rebalancingGroups,
} from '@/db/schema';
import type { DB, DbTransaction } from '@/db';
import type { RebalancingRole } from '@finance/shared/types/rebalancing';

/**
 * Called inside a DB transaction after a member transaction has been deleted.
 * The CASCADE will have already removed the membership row, so the source count
 * here reflects the remaining sources only.
 *
 * Used by both rebalancing.service (removeGroupTransaction) and
 * transactions.service (deleteTransaction) to keep group state consistent
 * after any code path that removes a member transaction.
 */
export async function updateGroupAfterMemberRemoval(
  tx: DB | DbTransaction,
  groupId: string,
  deletedRole: RebalancingRole
): Promise<void> {
  const updates: { flaggedForReview: boolean; status?: string } = {
    flaggedForReview: true,
  };

  if (deletedRole === 'source') {
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(rebalancingGroupTransactions)
      .where(
        and(
          eq(rebalancingGroupTransactions.groupId, groupId),
          eq(rebalancingGroupTransactions.role, 'source')
        )
      );
    if (Number(countRow?.count ?? 0) === 0) {
      updates.status = 'open';
    }
  }

  await tx
    .update(rebalancingGroups)
    .set(updates)
    .where(eq(rebalancingGroups.id, groupId));
}
