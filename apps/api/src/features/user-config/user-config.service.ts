import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  accounts,
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
  categorizationRules,
  imports,
  rebalancingGroups,
  tags,
  transactions,
  userConfig,
} from '@/db/schema';
import { db } from '@/db';
import type { DbTransaction } from '@/db';
import { seedUserCategories } from '@/db/seeders/user-categories';
import { seedUserRules } from '@/db/seeders/user-rules';
import type { UpdateUserConfigInput } from '@finance/shared/schemas/user-config';

const configColumns = {
  id: userConfig.id,
  userId: userConfig.userId,
  emergencyFundTarget: userConfig.emergencyFundTarget,
  needsPercentage: userConfig.needsPercentage,
  wantsPercentage: userConfig.wantsPercentage,
  investmentsPercentage: userConfig.investmentsPercentage,
  updatedAt: userConfig.updatedAt,
};

async function upsertUserConfig(userId: string) {
  const [row] = await db
    .insert(userConfig)
    .values({ userId })
    .onConflictDoUpdate({
      target: userConfig.userId,
      set: { userId: sql`EXCLUDED.user_id` },
    })
    .returning(configColumns);

  return row;
}

export async function getUserConfig(userId: string) {
  return upsertUserConfig(userId);
}

export async function updateUserConfig(
  userId: string,
  input: UpdateUserConfigInput
) {
  const existing = await upsertUserConfig(userId);

  const patch: Partial<typeof userConfig.$inferInsert> = {};

  if (input.allocations !== undefined) {
    patch.needsPercentage = input.allocations.needsPercentage;
    patch.wantsPercentage = input.allocations.wantsPercentage;
    patch.investmentsPercentage = input.allocations.investmentsPercentage;
  }

  if (Object.keys(patch).length === 0) return existing;

  const [updated] = await db
    .update(userConfig)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(userConfig.userId, userId))
    .returning(configColumns);

  return updated;
}

async function deleteAllUserData(
  userId: string,
  tx: DbTransaction
): Promise<void> {
  // Collect child-table IDs that don't have a direct userId column.
  const userAccounts = await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const userBudgets = await tx
    .select({ id: anticipatedBudget.id })
    .from(anticipatedBudget)
    .where(eq(anticipatedBudget.userId, userId));

  const accountIds = userAccounts.map((r) => r.id);
  const budgetIds = userBudgets.map((r) => r.id);

  if (accountIds.length > 0) {
    await tx
      .delete(transactions)
      .where(inArray(transactions.accountId, accountIds));
  }
  // Delete in FK dependency order: children before parents
  await tx.delete(imports).where(eq(imports.userId, userId));
  await tx.delete(accounts).where(eq(accounts.userId, userId));
  await tx
    .delete(categorizationRules)
    .where(eq(categorizationRules.userId, userId));
  await tx
    .delete(categories)
    .where(and(isNotNull(categories.userId), eq(categories.userId, userId)));
  await tx.delete(tags).where(eq(tags.userId, userId));

  if (budgetIds.length > 0) {
    await tx
      .delete(anticipatedBudgetMonths)
      .where(inArray(anticipatedBudgetMonths.anticipatedBudgetId, budgetIds));
  }

  await tx
    .delete(anticipatedBudget)
    .where(eq(anticipatedBudget.userId, userId));
  await tx.delete(userConfig).where(eq(userConfig.userId, userId));
  // rebalancingGroupTransactions rows cascade-delete when the group is deleted.
  await tx
    .delete(rebalancingGroups)
    .where(eq(rebalancingGroups.userId, userId));
}

export async function resetAccount(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await deleteAllUserData(userId, tx);
    await seedUserCategories(userId, tx);
    await seedUserRules(userId, tx);
    // Restore a clean default userConfig row.
    await tx.insert(userConfig).values({ userId });
  });
}
