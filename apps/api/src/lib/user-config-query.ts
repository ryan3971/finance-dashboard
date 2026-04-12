// Shared dashboard query — lives in lib/ for now since it's the only cross-feature
// DB query. If more shared queries are added, consider moving them into a dedicated
// lib/queries/ folder.
import { sql } from 'drizzle-orm';
import { userConfig } from '@/db/schema';
import { db } from '@/db';

export interface DashboardUserConfig {
  emergencyFundTarget: string | null;
  needsPercentage: number | null;
  wantsPercentage: number | null;
  investmentsPercentage: number | null;
}

export async function queryDashboardUserConfig(
  userId: string
): Promise<DashboardUserConfig> {
  const [row] = await db
    .insert(userConfig)
    .values({ userId })
    .onConflictDoUpdate({
      target: userConfig.userId,
      set: { userId: sql`EXCLUDED.user_id` },
    })
    .returning({
      emergencyFundTarget: userConfig.emergencyFundTarget,
      needsPercentage: userConfig.needsPercentage,
      wantsPercentage: userConfig.wantsPercentage,
      investmentsPercentage: userConfig.investmentsPercentage,
    });

  return row;
}
