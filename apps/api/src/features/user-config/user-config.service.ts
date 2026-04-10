import { eq, sql } from 'drizzle-orm';
import { userConfig } from '@/db/schema';
import { db } from '@/db';
import type { UpdateUserConfigInput } from '@finance/shared';

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
